"""SOFTWARE safety controller.

================================================================
 READ THIS: SOFTWARE SAFETY IS NOT ENOUGH FOR A REAL ROBOT.
================================================================
This module checks commands before they run, limits speeds, watches for
faults and latches a software emergency stop. It is a *second* layer.

A physical robot MUST ALSO have independent HARDWARE safety that works even
if this computer crashes, freezes or has a bug:
  * a red mushroom-head e-stop button wired to a safety relay/contactor that
    physically cuts motor power,
  * fuses / current-limited power supplies,
  * mechanical end-stops and low-torque settings on arms,
  * motor controllers with their own timeout (stop if commands stop arriving).
See docs/HARDWARE_ARCHITECTURE.md and docs/SAFETY_AND_TESTING_CHECKLIST.md.
"""

from __future__ import annotations

import logging
import math
import time
from dataclasses import dataclass, field

from humanoid.config.loader import SafetyLimits
from humanoid.core.actions import ACTION_SCHEMA, MOTION_ACTIONS, Action

log = logging.getLogger("humanoid.safety")

# Words that make the planner/safety refuse a task outright in this version.
FORBIDDEN_TOPICS = {
    "knife": "handling knives or sharp tools", "knives": "handling knives or sharp tools",
    "blade": "handling sharp tools", "scissors": "handling sharp tools",
    "stove": "using the stove/hob", "hob": "using the stove/hob", "oven": "using the oven",
    "fire": "anything involving fire", "boiling": "handling boiling liquids",
    "hot oil": "handling hot oil", "kettle": "handling boiling liquids",
    "bleach": "handling cleaning chemicals", "chemical": "handling chemicals",
    "medicine": "handling medicine", "pills": "handling medicine",
    "baby": "physical contact with children", "child": "physical contact with children",
    "lift person": "lifting people", "carry person": "lifting people",
    "hit": "hitting anything", "push person": "pushing people", "throw": "throwing objects",
    "gas": "touching gas appliances", "socket": "touching electrical sockets",
}

# fault code -> (severity, plain-English message)
KNOWN_FAULTS = {
    "motor_overheat":     ("critical", "Drive motor temperature too high"),
    "arm_joint_limit":    ("critical", "An arm joint reached its limit"),
    "collision":          ("critical", "Robot bumped into something"),
    "communication_loss": ("critical", "Lost contact with a motor controller"),
    "physical_estop":     ("critical", "Physical e-stop button is pressed"),
    "battery_critical":   ("critical", "Battery critically low"),
    "action_timeout":     ("critical", "An action took far too long"),
    "camera_failure":     ("warning",  "Camera not responding - vision tasks disabled"),
    "battery_low":        ("warning",  "Battery low - only charging is allowed"),
    "control_loop_slow":  ("warning",  "Control loop running late"),
    "grasp_failed":       ("warning",  "Gripper did not get a secure grip"),
}

INJECTABLE_FAULTS = ["motor_overheat", "arm_joint_limit", "collision",
                     "communication_loss", "camera_failure", "battery_low"]


@dataclass
class Fault:
    code: str
    severity: str
    message: str
    detail: str = ""
    time: float = field(default_factory=time.time)

    def to_dict(self):
        return {"code": self.code, "severity": self.severity, "message": self.message,
                "detail": self.detail, "time": self.time}


@dataclass
class SafetyDecision:
    allowed: bool
    reasons: list[str] = field(default_factory=list)


class SafetyController:
    def __init__(self, limits: SafetyLimits, payload_by_arm: dict[str, float] | None = None):
        self.limits = limits
        self.payload_by_arm = payload_by_arm or {}
        self.estop_engaged = False
        self.estop_reason = ""
        self.faults: dict[str, Fault] = {}
        self.event_history: list[dict] = []

    # ---- emergency stop -------------------------------------------------
    def engage_estop(self, reason: str) -> None:
        if not self.estop_engaged:
            log.warning("SOFTWARE E-STOP ENGAGED: %s", reason)
            self._event("estop", reason)
        self.estop_engaged = True
        self.estop_reason = reason

    def reset_estop(self, physical_button_pressed: bool) -> SafetyDecision:
        """Reset is only allowed when nothing critical is still wrong."""
        reasons = []
        if physical_button_pressed:
            reasons.append("Release (twist) the physical e-stop button first.")
        critical = [f.message for f in self.faults.values() if f.severity == "critical"]
        if critical:
            reasons.append("Clear critical faults first: " + "; ".join(critical))
        if reasons:
            return SafetyDecision(False, reasons)
        if self.estop_engaged:
            log.info("E-stop reset by operator")
            self._event("reset", "operator reset")
        self.estop_engaged = False
        self.estop_reason = ""
        return SafetyDecision(True)

    # ---- faults ---------------------------------------------------------
    def raise_fault(self, code: str, detail: str = "") -> Fault:
        severity, message = KNOWN_FAULTS.get(code, ("critical", f"Unknown fault '{code}'"))
        fault = self.faults.get(code)
        if fault is None:
            fault = Fault(code, severity, message, detail)
            self.faults[code] = fault
            log.warning("FAULT %s (%s): %s %s", code, severity, message, detail)
            self._event("fault", f"{code}: {message} {detail}".strip())
        if severity == "critical":
            self.engage_estop(f"Critical fault: {message}")
        return fault

    def clear_fault(self, code: str) -> None:
        if self.faults.pop(code, None):
            self._event("fault_cleared", code)

    def clear_all_faults(self) -> list[str]:
        cleared = list(self.faults)
        for code in cleared:
            self.clear_fault(code)
        return cleared

    def has_fault(self, code: str) -> bool:
        return code in self.faults

    # ---- command checks --------------------------------------------------
    def check_action(self, action: Action, ctx: dict) -> SafetyDecision:
        """Decide whether one action may run, given the current robot context.

        ctx keys: battery_percent, objects (name -> mass_kg), arms (list),
                  arm_payloads, camera_ok
        """
        L = self.limits
        reasons = list(action.validate_shape())
        if reasons:
            return SafetyDecision(False, reasons)
        p = action.params
        if self.estop_engaged:
            reasons.append(f"Emergency stop is engaged ({self.estop_reason}). Reset it first.")
        going_to_charge = action.type == "charge" or (
            action.type == "navigate_to" and p.get("purpose") == "charging")
        if action.type in MOTION_ACTIONS and not going_to_charge:
            if ctx.get("battery_percent", 100) < L.min_battery_percent_to_start or self.has_fault("battery_low"):
                reasons.append("Battery too low for movement. Send the robot to charge first.")
        if action.type == "move" and abs(float(p["distance_m"])) > L.max_single_move_m:
            reasons.append(f"Move of {p['distance_m']} m is more than the {L.max_single_move_m} m limit.")
        if action.type == "turn" and abs(float(p["degrees"])) > L.max_turn_deg:
            reasons.append(f"Turn of {p['degrees']} degrees is more than the {L.max_turn_deg} limit.")
        if action.type == "wait" and not 0 <= float(p["seconds"]) <= L.max_wait_s:
            reasons.append(f"Wait must be between 0 and {L.max_wait_s} seconds.")
        if action.type == "speak" and len(str(p["text"])) > L.max_speech_chars:
            reasons.append(f"Speech is longer than {L.max_speech_chars} characters.")
        if action.type in ("pick", "place"):
            arm = p["arm"]
            if arm not in ctx.get("arms", []):
                reasons.append(f"This robot version has no '{arm}' arm.")
        if action.type == "pick":
            if not ctx.get("camera_ok", True):
                reasons.append("Camera fault: picking objects needs working vision.")
            mass = ctx.get("objects", {}).get(p["object"])
            if mass is None:
                reasons.append(f"Unknown object '{p['object']}'.")
            else:
                limit = min(L.max_payload_kg_per_arm, self.payload_by_arm.get(p["arm"], math.inf))
                if mass > limit:
                    reasons.append(f"{p['object']} weighs {mass} kg; the {p['arm']} arm limit is {limit} kg.")
        return SafetyDecision(not reasons, reasons)

    def check_plan(self, steps: list[Action], ctx: dict) -> SafetyDecision:
        if not steps:
            return SafetyDecision(False, ["The plan has no steps."])
        if len(steps) > self.limits.max_plan_steps:
            return SafetyDecision(False, [f"Plan has {len(steps)} steps; the limit is {self.limits.max_plan_steps}."])
        reasons = []
        for i, step in enumerate(steps, 1):
            d = self.check_action(step, ctx)
            reasons += [f"Step {i} ({step.type}): {r}" for r in d.reasons]
        return SafetyDecision(not reasons, reasons)

    def limit_velocity(self, linear: float, angular_rps: float) -> tuple[float, float]:
        """Clamp a velocity command to the configured limits (always applied)."""
        if self.estop_engaged:
            return 0.0, 0.0
        vmax = self.limits.max_linear_speed_mps
        wmax = math.radians(self.limits.max_angular_speed_dps)
        return max(-vmax, min(vmax, linear)), max(-wmax, min(wmax, angular_rps))

    # ---- continuous monitoring ------------------------------------------
    def monitor(self, *, battery_percent: float, physical_estop: bool,
                collided_with: str | None, loop_dt: float, expected_dt: float) -> None:
        if physical_estop:
            self.raise_fault("physical_estop")
        elif "physical_estop" in self.faults:
            self.clear_fault("physical_estop")  # released; operator must still reset
        if battery_percent <= self.limits.critical_battery_percent:
            self.raise_fault("battery_critical", f"{battery_percent:.0f}%")
        elif battery_percent < self.limits.min_battery_percent_to_start:
            self.raise_fault("battery_low", f"{battery_percent:.0f}%")
        else:
            self.clear_fault("battery_low")
            if battery_percent > self.limits.critical_battery_percent + 5:
                self.clear_fault("battery_critical")
        if collided_with:
            self.raise_fault("collision", f"hit {collided_with}")
        if loop_dt > expected_dt * 5 and loop_dt > 0.25:
            self.raise_fault("control_loop_slow", f"{loop_dt*1000:.0f} ms tick")

    def status(self) -> dict:
        return {"estop_engaged": self.estop_engaged, "estop_reason": self.estop_reason,
                "faults": [f.to_dict() for f in self.faults.values()],
                "limits": self.limits.__dict__,
                "layer": "SOFTWARE safety only - real robots also need independent hardware e-stop"}

    def _event(self, kind: str, text: str) -> None:
        self.event_history.append({"time": time.time(), "kind": kind, "text": text})
        self.event_history = self.event_history[-100:]
