"""Builds a complete robot from a config file and runs its control loop."""

from __future__ import annotations

import logging
import threading
import time

from humanoid.config.loader import RobotConfig, load_config
from humanoid.core.robot import Robot
from humanoid.hardware.factory import build_hardware
from humanoid.simulation.world import SimWorld

log = logging.getLogger("humanoid.runtime")


def build_robot(config: RobotConfig | str | None = None) -> Robot:
    cfg = config if isinstance(config, RobotConfig) else load_config(config)
    world = SimWorld.from_file(cfg.world_file)
    world.robot_radius = float(cfg.body["radius_m"])
    hardware = build_hardware(cfg, world)
    return Robot(cfg, world, hardware)


class ControlLoop:
    """Calls robot.step() at a fixed rate in a background thread."""

    def __init__(self, robot: Robot, speed_factor: float | None = None):
        self.robot = robot
        self.speed = float(speed_factor or robot.config.simulation.get("speed_factor", 1.0))
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, name="control-loop", daemon=True)

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._thread.join(timeout=2)
        self.robot.cancel("Control loop stopped")

    def _run(self) -> None:
        dt = self.robot.tick_dt
        next_t = time.monotonic()
        while not self._stop.is_set():
            try:
                self.robot.step(dt * self.speed)
            except Exception:  # never let the loop die silently
                log.exception("Control loop error - triggering e-stop")
                self.robot.emergency_stop("Software error in control loop")
            next_t += dt
            delay = next_t - time.monotonic()
            if delay > 0:
                time.sleep(delay)
            else:
                next_t = time.monotonic()
