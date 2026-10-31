"""Simulated hardware: behaves like real parts, but acts on the SimWorld."""

from __future__ import annotations

import logging
import math

from humanoid.core.geometry import Pose, distance, wrap_angle
from humanoid.simulation.world import SimWorld

from .interfaces import (Arm, BatteryMonitor, Camera, DriveBase, EStopInput,
                         Gripper, HardwareFault, Speaker)

log = logging.getLogger("humanoid.hardware.sim")


class SimDriveBase(DriveBase):
    is_simulated = True

    def __init__(self, name, spec, world: SimWorld, battery: "SimBattery"):
        super().__init__(name, spec)
        self.world, self.battery = world, battery
        self.cmd_linear = 0.0
        self.cmd_angular = 0.0
        self.collided_with: str | None = None
        self.odometer_m = 0.0

    def set_velocity(self, linear_mps, angular_rps):
        self.cmd_linear, self.cmd_angular = linear_mps, angular_rps

    def stop(self):
        self.cmd_linear = self.cmd_angular = 0.0

    def get_pose(self) -> Pose:
        p = self.world.robot_pose
        return Pose(p.x, p.y, p.theta)

    def update(self, dt):
        if self.cmd_linear == 0.0 and self.cmd_angular == 0.0:
            return
        p = self.world.robot_pose
        theta = wrap_angle(p.theta + self.cmd_angular * dt)
        step = self.cmd_linear * dt
        new = Pose(p.x + step * math.cos(theta), p.y + step * math.sin(theta), theta)
        if self.world.move_robot(new):
            self.odometer_m += abs(step)
            self.battery.drain_for_distance(abs(step))
        else:
            self.collided_with = self.world.last_collision
            self.stop()


class SimArm(Arm):
    is_simulated = True
    SPEED_MPS = 0.5

    def __init__(self, name, spec, world: SimWorld, reach_m: float):
        super().__init__(name, spec)
        self.world, self.reach_m = world, reach_m
        self.target: tuple[float, float] | None = None
        self.status = "resting"

    def move_to(self, x, y, z=0.8):
        p = self.world.robot_pose
        d = distance(p.x, p.y, x, y)
        if d > self.reach_m:
            self.status = "target out of reach"
            raise HardwareFault(f"{self.name} arm: target is {d:.2f} m away, reach is {self.reach_m:.2f} m")
        self.target = (x, y)
        self.status = "extended"
        return 0.5 + d / self.SPEED_MPS

    def retract(self):
        self.target = None
        self.status = "resting"
        return 0.8

    def stop(self):
        if self.status not in ("resting",):
            self.status = "stopped"

    def get_state(self):
        return {"status": self.status,
                "target": [round(v, 2) for v in self.target] if self.target else None}


class SimGripper(Gripper):
    is_simulated = True
    GRASP_RADIUS_M = 0.25

    def __init__(self, name, spec, world: SimWorld, arm: SimArm):
        super().__init__(name, spec)
        self.world, self.arm = world, arm
        self.max_payload_kg = float(spec.get("max_payload_kg", 1.0))
        self._held: str | None = None
        self.last_error: str | None = None
        self.is_closed = False

    def close(self):
        self.last_error = None
        self.is_closed = True
        if self._held or not self.arm.target:
            return self._held
        tx, ty = self.arm.target
        near = self.world.objects_near(tx, ty, self.GRASP_RADIUS_M)
        if not near:
            self.last_error = "nothing to grasp at the hand position"
            return None
        obj = near[0]
        if obj.mass_kg > self.max_payload_kg:
            self.last_error = f"{obj.name} is too heavy ({obj.mass_kg} kg) and slipped"
            return None
        obj.held_by, obj.location = self.name, None
        self._held = obj.name
        return obj.name

    def open(self):
        self.is_closed = False
        if not self._held:
            return None
        obj = self.world.objects[self._held]
        x, y = self.arm.target or (self.world.robot_pose.x, self.world.robot_pose.y)
        obj.x, obj.y, obj.held_by = x, y, None
        nearest = min(self.world.locations.values(),
                      key=lambda l: distance(x, y, l.x, l.y), default=None)
        obj.location = nearest.name if nearest and distance(x, y, nearest.x, nearest.y) < 1.0 else None
        released, self._held = self._held, None
        return released

    def held_object(self):
        return self._held


class SimCamera(Camera):
    is_simulated = True

    def __init__(self, name, spec, world: SimWorld):
        super().__init__(name, spec)
        self.world = world
        self.range_m = float(spec.get("range_m", 4.0))
        self.failed = False

    def detect_objects(self):
        if self.failed:
            raise HardwareFault("camera is not responding (simulated fault)")
        p = self.world.robot_pose
        return [{"name": o.name, "x": o.x, "y": o.y, "confidence": 1.0}
                for o in self.world.objects.values()
                if not o.held_by and distance(p.x, p.y, o.x, o.y) <= self.range_m]

    def health(self):
        return {"ok": not self.failed, "detail": "failed" if self.failed else "ok"}


class SimSpeaker(Speaker):
    is_simulated = True

    def __init__(self, name, spec):
        super().__init__(name, spec)
        self.history: list[dict] = []

    def say(self, text, language="en"):
        self.history.append({"text": text, "language": language})
        self.history = self.history[-20:]
        log.info("ROBOT SAYS (%s): %s", language, text)


class SimBattery(BatteryMonitor):
    is_simulated = True
    CHARGE_RATE_PCT_PER_S = 5.0  # fast, so the demo doesn't take hours

    def __init__(self, name, spec):
        super().__init__(name, spec)
        self._percent = float(spec.get("start_percent", 90))
        self._drain = float(spec.get("drain_percent_per_metre", 0.3))
        self._charging = False

    def percent(self):
        return self._percent

    def set_percent(self, value: float):
        self._percent = max(0.0, min(100.0, value))

    def drain_for_distance(self, metres: float):
        self.set_percent(self._percent - metres * self._drain)

    def set_charging(self, charging):
        self._charging = charging

    @property
    def charging(self):
        return self._charging

    def update(self, dt):
        if self._charging:
            self.set_percent(self._percent + self.CHARGE_RATE_PCT_PER_S * dt)


class SimEStopInput(EStopInput):
    """A pretend physical e-stop button you can 'press' from the dashboard."""

    is_simulated = True

    def __init__(self, name, spec):
        super().__init__(name, spec)
        self.pressed = False

    def is_pressed(self):
        return self.pressed
