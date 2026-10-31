"""The Robot controller: the "brain stem" that runs actions safely.

Every control tick (20 times a second by default) it:
  1. reads sensors and lets the SafetyController check for faults,
  2. advances the current action by one small step,
  3. lets the hardware (or simulator) move.

Actions are written as Python generators: each ``yield`` hands control back
for one tick. That means an emergency stop can interrupt any action between
any two ticks.
"""

from __future__ import annotations

import logging
import math
import threading
import time
from collections import deque

from humanoid.config.loader import RobotConfig
from humanoid.core.actions import Action, Plan
from humanoid.core.geometry import distance, wrap_angle
from humanoid.diagnostics import memory_handler
from humanoid.features import feature_list
from humanoid.hardware.factory import HardwareBundle
from humanoid.hardware.interfaces import HardwareFault
from humanoid.navigation.planner import GridPlanner
from humanoid.planning.rule_planner import RuleBasedPlanner
from humanoid.safety.controller import INJECTABLE_FAULTS, SafetyController
from humanoid.simulation.world import SimWorld

log = logging.getLogger("humanoid.robot")


class ActionFailed(Exception):
    pass


class Robot:
    def __init__(self, config: RobotConfig, world: SimWorld, hardware: HardwareBundle):
        self.config = config
        self.world = world  # in simulation: ground truth. On a real robot: the map/world model.
        self.hw = hardware
        payloads = {side: float(g.spec.get("max_payload_kg", config.limits.max_payload_kg_per_arm))
                    for side, g in hardware.grippers.items()}
        self.safety = SafetyController(config.limits, payloads)
        self.reach = float(config.body["arm_reach_m"])
        self.approach = float(config.body["approach_distance_m"])
        self.nav = GridPlanner(world)
        self.planner = RuleBasedPlanner(world, config.arm_names, self.approach)
        self.lock = threading.RLock()
        self.sim_time = 0.0
        self.tick_dt = 1.0 / float(config.simulation.get("tick_hz", 20))
        self.mode = "idle"
        self.queue: deque[Action] = deque()
        self.current: Action | None = None
        self._gen = None
        self._action_started = 0.0
        self.active_plan: dict | None = None
        self.plans: dict[int, Plan] = {}
        self.history: deque[dict] = deque(maxlen=30)
        self.path: list[tuple[float, float]] = []
        self.last_error = ""
        self.last_message = "Ready."
        log.info("Robot '%s' (%s) ready. Arms: %s. Simulation only: %s",
                 config.name, config.model, ", ".join(config.arm_names), config.uses_only_simulation)

    # ================================================================ commands
    def plan(self, instruction: str) -> Plan:
        with self.lock:
            held = {side: g.held_object() for side, g in self.hw.grippers.items()}
            plan = self.planner.plan(instruction, held=held)
            if plan.ok:
                decision = self.safety.check_plan(plan.steps, self._safety_ctx())
                plan.errors += decision.reasons
            self.plans[plan.id] = plan
            while len(self.plans) > 20:
                self.plans.pop(next(iter(self.plans)))
            log.info("Planned '%s': %d steps, %d errors", instruction, len(plan.steps), len(plan.errors))
            return plan

    def execute_plan(self, plan_id: int) -> dict:
        with self.lock:
            plan = self.plans.get(plan_id)
            if plan is None:
                return {"ok": False, "reasons": ["That plan no longer exists. Please plan again."]}
            if plan.errors or not plan.steps:
                return {"ok": False, "reasons": plan.errors or ["Plan is empty."]}
            if self.busy:
                return {"ok": False, "reasons": ["Robot is busy. Wait, or press Cancel first."]}
            # Re-plan from the *current* state in case things changed since planning.
            fresh = self.plan(plan.instruction)
            if not fresh.ok:
                return {"ok": False, "reasons": fresh.errors}
            return self._enqueue(fresh.steps, fresh.instruction)

    def run_action(self, action: Action) -> dict:
        """Run one manual command (e.g. a dashboard arrow button)."""
        with self.lock:
            if self.busy:
                return {"ok": False, "reasons": ["Robot is busy. Wait, or press Cancel first."]}
            return self._enqueue([action], action.description or action.type)

    def _enqueue(self, steps: list[Action], label: str) -> dict:
        decision = self.safety.check_plan(steps, self._safety_ctx())
        if not decision.allowed:
            log.warning("Refused '%s': %s", label, "; ".join(decision.reasons))
            return {"ok": False, "reasons": decision.reasons}
        self.queue.extend(steps)
        self.active_plan = {"label": label, "total": len(steps), "done": 0}
        self.mode = "executing"
        self.last_error = ""
        log.info("Starting '%s' (%d steps)", label, len(steps))
        return {"ok": True, "reasons": []}

    def cancel(self, reason: str = "Cancelled by operator") -> None:
        """Normal (non-emergency) stop: finish nothing, stop motors, stay ready."""
        with self.lock:
            if self.busy:
                log.info("%s", reason)
            self._halt()
            if self.mode != "estopped":
                self.mode = "idle"
            self.last_message = reason

    def emergency_stop(self, reason: str = "STOP button pressed") -> None:
        with self.lock:
            self.safety.engage_estop(reason)
            self._halt()
            self.mode = "estopped"
            self.last_message = f"EMERGENCY STOP: {reason}"

    def reset(self) -> dict:
        with self.lock:
            d = self.safety.reset_estop(self.hw.estop_input.is_pressed())
            if d.allowed:
                self.mode = "idle"
                self.last_message = "E-stop reset. Ready."
            return {"ok": d.allowed, "reasons": d.reasons}

    def inject_fault(self, code: str) -> dict:
        """Simulation only: pretend a part failed, to test the safety system."""
        with self.lock:
            if code not in INJECTABLE_FAULTS:
                return {"ok": False, "reasons": [f"Unknown fault. Choose one of: {', '.join(INJECTABLE_FAULTS)}"]}
            if code == "camera_failure" and hasattr(self.hw.camera, "failed"):
                self.hw.camera.failed = True
            self.safety.raise_fault(code, "simulated by operator")
            if self.safety.estop_engaged:
                self._halt()
                self.mode = "estopped"
            return {"ok": True, "reasons": []}

    def clear_faults(self) -> dict:
        with self.lock:
            if hasattr(self.hw.camera, "failed"):
                self.hw.camera.failed = False
            cleared = self.safety.clear_all_faults()
            log.info("Faults cleared: %s", ", ".join(cleared) or "none")
            return {"ok": True, "reasons": [], "cleared": cleared}

    def sim_set_physical_estop(self, pressed: bool) -> dict:
        with self.lock:
            if not hasattr(self.hw.estop_input, "pressed"):
                return {"ok": False, "reasons": ["Not a simulated e-stop button."]}
            self.hw.estop_input.pressed = pressed
            log.warning("Simulated PHYSICAL e-stop button %s", "PRESSED" if pressed else "released")
            return {"ok": True, "reasons": []}

    def sim_set_battery(self, percent: float) -> dict:
        with self.lock:
            if not hasattr(self.hw.battery, "set_percent"):
                return {"ok": False, "reasons": ["Not a simulated battery."]}
            self.hw.battery.set_percent(float(percent))
            log.info("Simulated battery set to %.0f%%", percent)
            return {"ok": True, "reasons": []}

    def sim_reset_world(self) -> dict:
        with self.lock:
            self._halt()
            self.world.reset()
            self.world.robot_radius = float(self.config.body["radius_m"])
            for g in self.hw.grippers.values():
                if hasattr(g, "_held"):
                    g._held = None
            for a in self.hw.arms.values():
                a.retract()
            self.safety.clear_all_faults()
            if hasattr(self.hw.camera, "failed"):
                self.hw.camera.failed = False
            if hasattr(self.hw.estop_input, "pressed"):
                self.hw.estop_input.pressed = False
            self.safety.reset_estop(False)
            if hasattr(self.hw.battery, "set_percent"):
                self.hw.battery.set_percent(float(self.config.hardware["battery"].get("start_percent", 90)))
            self.mode = "idle"
            self.last_message = "Simulation reset."
            log.info("Simulation world reset")
            return {"ok": True, "reasons": []}

    @property
    def busy(self) -> bool:
        return self.current is not None or bool(self.queue)

    # ================================================================ control loop
    def step(self, dt: float | None = None) -> None:
        dt = self.tick_dt if dt is None else dt
        with self.lock:
            self.sim_time += dt
            collided = getattr(self.hw.drive, "collided_with", None)
            if collided:
                self.hw.drive.collided_with = None
            self.safety.monitor(battery_percent=self.hw.battery.percent(),
                                physical_estop=self.hw.estop_input.is_pressed(),
                                collided_with=collided, loop_dt=dt, expected_dt=self.tick_dt)
            if getattr(self.hw.camera, "failed", False) and not self.safety.has_fault("camera_failure"):
                self.safety.raise_fault("camera_failure")
            if self.safety.estop_engaged:
                if self.mode != "estopped" or self.busy:
                    self._halt()
                    self.mode = "estopped"
                    self.last_message = f"EMERGENCY STOP: {self.safety.estop_reason}"
                self.hw.update(dt)
                return

            if self.current is None and self.queue:
                self._start_next()
            if self.current is not None:
                self._advance()
            self.hw.update(dt)
            if self.mode != "estopped":
                self.mode = "executing" if self.busy else "idle"

    def _start_next(self) -> None:
        action = self.queue.popleft()
        decision = self.safety.check_action(action, self._safety_ctx())
        if not decision.allowed:
            self._fail(action, "Safety check failed: " + "; ".join(decision.reasons))
            return
        self.current = action
        self._gen = self._run(action)
        self._action_started = self.sim_time
        log.info("-> %s", action.description or action.type)

    def _advance(self) -> None:
        action = self.current
        if self.sim_time - self._action_started > self.config.limits.max_action_duration_s:
            self.safety.raise_fault("action_timeout", action.description)
            self._halt()
            self.mode = "estopped"
            return
        try:
            next(self._gen)
        except StopIteration:
            self.history.appendleft({"action": action.to_dict(), "result": "done", "time": self.sim_time})
            if self.active_plan:
                self.active_plan["done"] += 1
            self.current, self._gen = None, None
            if not self.queue:
                self.last_message = f"Finished: {self.active_plan['label'] if self.active_plan else action.type}"
                log.info("Task complete")
                self.active_plan = None
        except (ActionFailed, HardwareFault) as e:
            self._fail(action, str(e))

    def _fail(self, action: Action, reason: str) -> None:
        log.warning("Action '%s' failed: %s", action.description or action.type, reason)
        self.history.appendleft({"action": action.to_dict(), "result": f"failed: {reason}", "time": self.sim_time})
        self._halt()
        self.last_error = reason
        self.last_message = f"Task stopped: {reason}"

    def _halt(self) -> None:
        if self._gen is not None:
            self._gen.close()
        self._gen, self.current = None, None
        self.queue.clear()
        self.active_plan = None
        self.path = []
        self.hw.drive.stop()
        for arm in self.hw.arms.values():
            arm.stop()
        for g in self.hw.grippers.values():
            g.stop()  # keep holding: dropping things on e-stop could be dangerous
        self.hw.battery.set_charging(False)

    def run_until_idle(self, max_seconds: float = 300.0) -> bool:
        """Testing helper: step the simulation as fast as possible until done."""
        steps = int(max_seconds / self.tick_dt)
        for _ in range(steps):
            self.step()
            if not self.busy:
                return True
        return False

    # ================================================================ action programs
    def _run(self, a: Action):
        p = a.params
        if a.type == "navigate_to":
            return self._do_navigate(p["target"], p.get("target_kind", "location"))
        if a.type == "move":
            return self._do_move(float(p["distance_m"]))
        if a.type == "turn":
            return self._do_turn(math.radians(float(p["degrees"])))
        if a.type == "pick":
            return self._do_pick(p["object"], p["arm"])
        if a.type == "place":
            return self._do_place(p["object"], p["location"], p["arm"])
        if a.type == "speak":
            return self._do_speak(str(p["text"]), p.get("language", "en"))
        if a.type == "wait":
            return self._wait(float(p["seconds"]))
        if a.type == "charge":
            return self._do_charge()
        raise ActionFailed(f"No program for action '{a.type}'")

    def _drive(self, v: float, w: float) -> None:
        v, w = self.safety.limit_velocity(v, w)
        self.hw.drive.set_velocity(v, w)

    def _wait(self, seconds: float):
        end = self.sim_time + seconds
        while self.sim_time < end - 1e-9:
            yield

    def _resolve_target(self, target: str, kind: str) -> tuple[float, float, float]:
        """Returns (x, y, stop_distance)."""
        if kind == "object":
            obj = self.world.objects.get(target)
            if obj is None:
                raise ActionFailed(f"Unknown object '{target}'")
            if obj.held_by:
                raise ActionFailed(f"The {target} is being held")
            return obj.x, obj.y, self.approach
        loc = self.world.locations.get(target)
        if loc is None:
            raise ActionFailed(f"Unknown place '{target}'")
        stop = 0.1 if loc.kind in ("dock", "area") else self.approach
        return loc.x, loc.y, stop

    def _do_navigate(self, target: str, kind: str):
        gx, gy, stop = self._resolve_target(target, kind)
        pose = self.hw.drive.get_pose()
        if distance(pose.x, pose.y, gx, gy) > stop:
            path = self.nav.plan((pose.x, pose.y), (gx, gy))
            if path is None:
                raise ActionFailed(f"No safe path to {target.replace('_', ' ')}")
            self.path = list(path)
            vmax = self.config.limits.max_linear_speed_mps
            for i, (wx, wy) in enumerate(path):
                last = i == len(path) - 1
                while True:
                    pose = self.hw.drive.get_pose()
                    if distance(pose.x, pose.y, gx, gy) <= stop:
                        break
                    d = distance(pose.x, pose.y, wx, wy)
                    if d < (0.05 if last else 0.15):
                        break
                    err = wrap_angle(math.atan2(wy - pose.y, wx - pose.x) - pose.theta)
                    if abs(err) > 0.35:
                        self._drive(0.0, 3.0 * err)
                    else:
                        remaining = distance(pose.x, pose.y, gx, gy) - stop if last else d
                        self._drive(min(vmax, 0.8 * remaining + 0.05), 2.5 * err)
                    yield
                if distance(pose.x, pose.y, gx, gy) <= stop:
                    break
            self.hw.drive.stop()
            self.path = []
        pose = self.hw.drive.get_pose()
        final = distance(pose.x, pose.y, gx, gy)
        if kind == "object" and final > self.reach:
            raise ActionFailed(f"Could not get close enough to the {target} ({final:.2f} m away)")
        if kind != "object" and final > max(stop, self.reach):
            raise ActionFailed(f"Could not reach {target.replace('_', ' ')} ({final:.2f} m away)")

    def _do_move(self, dist: float):
        start = self.hw.drive.get_pose()
        sign = 1 if dist >= 0 else -1
        # Check the map before moving (a real robot would also use bumpers/LiDAR).
        steps = max(1, int(abs(dist) / 0.05))
        for i in range(1, steps + 1):
            t = dist * i / steps
            x, y = start.x + t * math.cos(start.theta), start.y + t * math.sin(start.theta)
            if not self.world.is_free(x, y):
                raise ActionFailed(f"Path blocked by {self.world.what_is_hit(x, y)}; move refused")
        vmax = self.config.limits.max_linear_speed_mps
        while True:
            pose = self.hw.drive.get_pose()
            done = distance(start.x, start.y, pose.x, pose.y)
            remaining = abs(dist) - done
            if remaining <= 0.01:
                break
            self._drive(sign * min(vmax, 0.8 * remaining + 0.05), 0.0)
            yield
        self.hw.drive.stop()

    def _do_turn(self, angle: float):
        """Turn by `angle` radians (+ = left), tracking the total rotation so
        that big turns (180, 360 degrees) go the requested way."""
        last = self.hw.drive.get_pose().theta
        turned = 0.0
        while True:
            th = self.hw.drive.get_pose().theta
            turned += wrap_angle(th - last)
            last = th
            remaining = angle - turned
            if abs(remaining) < 0.02:
                break
            w = 3.0 * remaining
            if abs(w) < 0.15:
                w = math.copysign(0.15, remaining)
            self._drive(0.0, w)
            yield
        self.hw.drive.stop()

    def _face(self, x: float, y: float):
        pose = self.hw.drive.get_pose()
        if distance(pose.x, pose.y, x, y) < 0.05:
            return
        err = wrap_angle(math.atan2(y - pose.y, x - pose.x) - pose.theta)
        if abs(err) > 0.05:
            yield from self._do_turn(err)

    def _do_pick(self, name: str, side: str):
        arm, grip = self.hw.arms[side], self.hw.grippers[side]
        obj = self.world.objects.get(name)
        if obj is None:
            raise ActionFailed(f"Unknown object '{name}'")
        if obj.held_by:
            raise ActionFailed(f"The {name} is already being held")
        if grip.held_object():
            raise ActionFailed(f"The {side} hand is already holding the {grip.held_object()}")
        if self.hw.camera is not None:
            seen = {d["name"] for d in self.hw.camera.detect_objects()}
            if name not in seen:
                raise ActionFailed(f"I can't see the {name} from here")
        pose = self.hw.drive.get_pose()
        if distance(pose.x, pose.y, obj.x, obj.y) > self.reach:
            raise ActionFailed(f"The {name} is out of reach. Go to it first.")
        yield from self._face(obj.x, obj.y)
        yield from self._wait(arm.move_to(obj.x, obj.y))
        got = grip.close()
        yield from self._wait(0.5)
        if got != name:
            reason = getattr(grip, "last_error", None) or "grip failed"
            grip.open()
            yield from self._wait(arm.retract())
            raise ActionFailed(f"Could not pick up the {name}: {reason}")
        yield from self._wait(arm.retract())
        log.info("Picked up the %s with the %s hand", name, side)

    def _do_place(self, name: str, location: str, side: str):
        arm, grip = self.hw.arms[side], self.hw.grippers[side]
        if grip.held_object() != name:
            raise ActionFailed(f"The {side} hand is not holding the {name}")
        loc = self.world.locations.get(location)
        if loc is None:
            raise ActionFailed(f"Unknown place '{location}'")
        pose = self.hw.drive.get_pose()
        if distance(pose.x, pose.y, loc.x, loc.y) > self.reach:
            raise ActionFailed(f"The {loc.label} is out of reach. Go to it first.")
        yield from self._face(loc.x, loc.y)
        yield from self._wait(arm.move_to(loc.x, loc.y))
        grip.open()
        yield from self._wait(0.5)
        yield from self._wait(arm.retract())
        log.info("Placed the %s at the %s", name, loc.label)

    def _do_speak(self, text: str, language: str):
        if self.hw.speaker is None:
            raise ActionFailed("This robot version has no speaker")
        self.hw.speaker.say(text, language)
        yield from self._wait(min(10.0, 0.5 + 0.06 * len(text)))

    def _do_charge(self):
        dock = next((l for l in self.world.locations.values() if l.kind == "dock"), None)
        pose = self.hw.drive.get_pose()
        if dock is None or distance(pose.x, pose.y, dock.x, dock.y) > 0.3:
            raise ActionFailed("Not at the charging dock")
        self.hw.battery.set_charging(True)
        while self.hw.battery.percent() < 99.5:
            yield
        self.hw.battery.set_charging(False)
        log.info("Battery charged to %.0f%%", self.hw.battery.percent())

    # ================================================================ status
    def _safety_ctx(self) -> dict:
        cam_ok = self.hw.camera is not None and self.hw.camera.health().get("ok", True) \
            and not self.safety.has_fault("camera_failure")
        return {"battery_percent": self.hw.battery.percent(),
                "objects": {n: o.mass_kg for n, o in self.world.objects.items()},
                "arms": list(self.hw.arms), "camera_ok": cam_ok}

    def state(self, log_after: int = 0) -> dict:
        with self.lock:
            pose = self.hw.drive.get_pose()
            arms = {side: {**self.hw.arms[side].get_state(), "holding": self.hw.grippers[side].held_object()}
                    for side in self.hw.arms}
            return {
                "robot": self.config.summary(),
                "mode": self.mode,
                "message": self.last_message,
                "last_error": self.last_error,
                "sim_time": round(self.sim_time, 2),
                "pose": pose.to_dict(),
                "body_radius_m": self.config.body["radius_m"],
                "arm_reach_m": self.reach,
                "battery": {"percent": round(self.hw.battery.percent(), 1), "charging": self.hw.battery.charging},
                "arms": arms,
                "current_action": self.current.to_dict() if self.current else None,
                "queue": [a.to_dict() for a in self.queue],
                "task": dict(self.active_plan) if self.active_plan else None,
                "history": list(self.history)[:10],
                "path": [[round(x, 2), round(y, 2)] for x, y in self.path],
                "safety": self.safety.status(),
                "physical_estop_pressed": self.hw.estop_input.is_pressed(),
                "hardware": self.hw.describe(),
                "speech": list(getattr(self.hw.speaker, "history", []))[-5:],
                "world": self.world.to_dict(),
                "log": [r for r in memory_handler().recent(60) if r["seq"] > log_after],
                "injectable_faults": INJECTABLE_FAULTS,
                "server_time": time.time(),
            }

    def info(self) -> dict:
        return {"robot": self.config.summary(), "features": feature_list(),
                "limits": self.config.limits.__dict__}
