"""PLACEHOLDERS for real hardware drivers.  *** NOT IMPLEMENTED ***

Nothing here talks to real devices yet. Each class documents the part it is
meant for and raises NotImplementedError if anyone tries to use it. This is
intentional: no software path can move a physical motor until a driver has
been written, bench-tested with wheels off the ground, and the hardware
safety checklist (docs/SAFETY_AND_TESTING_CHECKLIST.md) has been completed.
"""

from __future__ import annotations

from .interfaces import Arm, BatteryMonitor, Camera, DriveBase, EStopInput, Gripper


class _NotImplementedDriver:
    driver_name = "?"
    intended_for = "?"

    def connect(self):
        raise NotImplementedError(
            f"NOT IMPLEMENTED YET: driver '{self.driver_name}' ({self.intended_for}). "
            "Use a 'sim' driver until this is written and bench-tested.")

    def _ni(self, *_, **__):
        self.connect()


class SerialMotorDriveBase(_NotImplementedDriver, DriveBase):
    driver_name = "serial_motor_controller"
    intended_for = "wheel motor controller over USB serial (e.g. a hoverboard-motor or Roboclaw controller)"
    set_velocity = stop = get_pose = _NotImplementedDriver._ni


class SerialBusServoArm(_NotImplementedDriver, Arm):
    driver_name = "serial_bus_servo_arm"
    intended_for = "6-DOF arm built from serial bus servos (e.g. open-source SO-101 style arm)"
    move_to = retract = stop = get_state = _NotImplementedDriver._ni


class SerialBusServoGripper(_NotImplementedDriver, Gripper):
    driver_name = "serial_bus_servo_gripper"
    intended_for = "servo-driven gripper on the end of an arm"
    open = close = held_object = _NotImplementedDriver._ni


class UsbCamera(_NotImplementedDriver, Camera):
    driver_name = "usb_camera"
    intended_for = "USB webcam / depth camera with object detection (future: OpenCV + an AI vision model)"
    detect_objects = _NotImplementedDriver._ni


class Ina219BatteryMonitor(_NotImplementedDriver, BatteryMonitor):
    driver_name = "ina219_battery_monitor"
    intended_for = "INA219/INA226 voltage-current sensor on the battery"
    percent = set_charging = _NotImplementedDriver._ni


class GpioEStopMonitor(_NotImplementedDriver, EStopInput):
    driver_name = "gpio_estop_monitor"
    intended_for = "reads an auxiliary contact on the PHYSICAL e-stop (the e-stop itself must cut power in hardware)"
    is_pressed = _NotImplementedDriver._ni
