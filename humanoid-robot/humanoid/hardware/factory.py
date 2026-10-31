"""Builds the robot's hardware from a config file ("driver" names -> classes)."""

from __future__ import annotations

from dataclasses import dataclass, field

from humanoid.config.loader import RobotConfig
from humanoid.simulation.world import SimWorld

from . import real_stubs, simulated
from .interfaces import (Arm, BatteryMonitor, Camera, DriveBase, EStopInput,
                         Gripper, HardwareComponent, Speaker)


class HardwareNotAllowedError(Exception):
    """A config asked for real hardware without explicit permission."""


REAL_DRIVERS = {
    "serial_motor_controller": real_stubs.SerialMotorDriveBase,
    "serial_bus_servo_arm": real_stubs.SerialBusServoArm,
    "serial_bus_servo_gripper": real_stubs.SerialBusServoGripper,
    "usb_camera": real_stubs.UsbCamera,
    "ina219_battery_monitor": real_stubs.Ina219BatteryMonitor,
    "gpio_estop_monitor": real_stubs.GpioEStopMonitor,
}


@dataclass
class HardwareBundle:
    drive: DriveBase
    arms: dict[str, Arm]
    grippers: dict[str, Gripper]
    battery: BatteryMonitor
    estop_input: EStopInput
    camera: Camera | None = None
    speaker: Speaker | None = None
    extra: dict = field(default_factory=dict)

    def all(self) -> list[HardwareComponent]:
        parts = [self.drive, *self.arms.values(), *self.grippers.values(),
                 self.battery, self.estop_input, self.camera, self.speaker]
        return [p for p in parts if p is not None]

    def update(self, dt: float) -> None:
        for p in self.all():
            p.update(dt)

    def describe(self) -> list[dict]:
        out = []
        for p in self.all():
            out.append({"name": p.name, "kind": type(p).__name__,
                        "simulated": p.is_simulated, **p.health()})
        return out


def _check_allowed(config: RobotConfig) -> None:
    real = [s["driver"] for s in config.iter_hardware() if s["driver"] != "sim"]
    if not real:
        return
    unknown = [d for d in real if d not in REAL_DRIVERS]
    if unknown:
        raise HardwareNotAllowedError(f"Unknown hardware driver(s): {', '.join(unknown)}")
    if not config.allow_real_hardware:
        raise HardwareNotAllowedError(
            f"Config '{config.source_file.name}' uses real hardware drivers ({', '.join(sorted(set(real)))}) "
            "but 'allow_real_hardware' is false. This is a safety lock. Only change it after the "
            "hardware safety checklist is complete and a physical e-stop is fitted.")


def build_hardware(config: RobotConfig, world: SimWorld) -> HardwareBundle:
    _check_allowed(config)
    hw = config.hardware
    reach = float(config.body["arm_reach_m"])

    def make(part: str, name: str, spec: dict, sim_factory):
        if spec["driver"] == "sim":
            return sim_factory()
        obj = REAL_DRIVERS[spec["driver"]](name, spec)
        obj.connect()  # real stubs raise NotImplementedError here
        return obj

    battery = make("battery", "battery", hw["battery"], lambda: simulated.SimBattery("battery", hw["battery"]))
    drive = make("drive", "drive", hw["drive"],
                 lambda: simulated.SimDriveBase("drive", hw["drive"], world, battery))
    arms, grippers = {}, {}
    for side, spec in hw["arms"].items():
        arms[side] = make("arm", side, spec, lambda s=side, sp=spec: simulated.SimArm(s, sp, world, reach))
        gspec = hw["grippers"][side]
        grippers[side] = make("gripper", side, gspec,
                              lambda s=side, sp=gspec: simulated.SimGripper(s, sp, world, arms[s]))
    estop = make("estop_input", "estop_button", hw["estop_input"],
                 lambda: simulated.SimEStopInput("estop_button", hw["estop_input"]))
    camera = speaker = None
    if hw.get("camera"):
        camera = make("camera", "camera", hw["camera"], lambda: simulated.SimCamera("camera", hw["camera"], world))
    if hw.get("speaker"):
        speaker = make("speaker", "speaker", hw["speaker"], lambda: simulated.SimSpeaker("speaker", hw["speaker"]))
    return HardwareBundle(drive=drive, arms=arms, grippers=grippers, battery=battery,
                          estop_input=estop, camera=camera, speaker=speaker)
