"""Hardware interfaces (the "contract" every real or simulated part must follow).

The robot's brain only ever talks to these interfaces. A simulated arm and a
real servo arm both implement ``Arm``, so the rest of the software does not
care which one is plugged in. Swapping simulation for real hardware is a
config change, not a rewrite.

Units: metres, seconds, radians, kilograms, percent.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from humanoid.core.geometry import Pose


class HardwareFault(Exception):
    """A hardware part reported a problem (e.g. camera unplugged)."""


class HardwareComponent(ABC):
    is_simulated: bool = False

    def __init__(self, name: str, spec: dict | None = None):
        self.name = name
        self.spec = spec or {}

    def connect(self) -> None:
        """Open serial ports / USB devices. Simulated parts do nothing."""

    def disconnect(self) -> None:
        """Release the device. Must be safe to call more than once."""

    def update(self, dt: float) -> None:
        """Called every control tick. Simulated parts advance time here."""

    def health(self) -> dict:
        return {"ok": True, "detail": "ok"}


class DriveBase(HardwareComponent):
    """Wheels/legs that move the robot around the floor."""

    @abstractmethod
    def set_velocity(self, linear_mps: float, angular_rps: float) -> None: ...

    @abstractmethod
    def stop(self) -> None:
        """Command zero speed immediately."""

    @abstractmethod
    def get_pose(self) -> Pose:
        """Best estimate of where the robot is (odometry / localisation)."""


class Arm(HardwareComponent):
    """One robotic arm. Future: full 6-DOF joint control + inverse kinematics."""

    @abstractmethod
    def move_to(self, x: float, y: float, z: float = 0.8) -> float:
        """Move the hand to a world point. Returns expected duration (s)."""

    @abstractmethod
    def retract(self) -> float:
        """Fold the arm back to its safe resting pose. Returns duration (s)."""

    @abstractmethod
    def stop(self) -> None: ...

    @abstractmethod
    def get_state(self) -> dict: ...


class Gripper(HardwareComponent):
    """A hand/gripper on the end of an arm."""

    @abstractmethod
    def close(self) -> str | None:
        """Close the gripper. Returns the name of what was grasped, or None."""

    @abstractmethod
    def open(self) -> str | None:
        """Open the gripper. Returns the name of what was released, or None."""

    @abstractmethod
    def held_object(self) -> str | None: ...

    def stop(self) -> None:
        """Hold current grip. (On e-stop we do NOT drop objects.)"""


class Camera(HardwareComponent):
    @abstractmethod
    def detect_objects(self) -> list[dict]:
        """Return objects seen: [{name, x, y, confidence}]. Raises HardwareFault."""


class Speaker(HardwareComponent):
    @abstractmethod
    def say(self, text: str, language: str = "en") -> None: ...


class BatteryMonitor(HardwareComponent):
    @abstractmethod
    def percent(self) -> float: ...

    @abstractmethod
    def set_charging(self, charging: bool) -> None: ...

    @property
    def charging(self) -> bool:
        return False


class EStopInput(HardwareComponent):
    """Reads the state of the PHYSICAL emergency-stop button.

    IMPORTANT: on the real robot the physical e-stop button must cut motor
    power through hardware (a safety relay/contactor) WITHOUT relying on this
    software. This interface only lets the software *notice* the button so it
    can also stop planning and log the event.
    """

    @abstractmethod
    def is_pressed(self) -> bool: ...
