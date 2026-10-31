import unittest

from tests.helpers import make_robot  # noqa: F401
from humanoid.hardware import interfaces, real_stubs, simulated
from humanoid.hardware.factory import REAL_DRIVERS


class HardwareInterfaceTests(unittest.TestCase):
    def test_simulated_parts_implement_interfaces(self):
        robot = make_robot()
        hw = robot.hw
        self.assertIsInstance(hw.drive, interfaces.DriveBase)
        self.assertIsInstance(hw.battery, interfaces.BatteryMonitor)
        self.assertIsInstance(hw.estop_input, interfaces.EStopInput)
        for arm in hw.arms.values():
            self.assertIsInstance(arm, interfaces.Arm)
        for g in hw.grippers.values():
            self.assertIsInstance(g, interfaces.Gripper)
        self.assertTrue(all(p.is_simulated for p in hw.all()))

    def test_real_drivers_are_honest_placeholders(self):
        for name, cls in REAL_DRIVERS.items():
            part = cls("test", {})
            with self.assertRaisesRegex(NotImplementedError, "NOT IMPLEMENTED"):
                part.connect()

    def test_real_stubs_match_interfaces(self):
        pairs = [(real_stubs.SerialMotorDriveBase, interfaces.DriveBase),
                 (real_stubs.SerialBusServoArm, interfaces.Arm),
                 (real_stubs.SerialBusServoGripper, interfaces.Gripper),
                 (real_stubs.UsbCamera, interfaces.Camera),
                 (real_stubs.Ina219BatteryMonitor, interfaces.BatteryMonitor),
                 (real_stubs.GpioEStopMonitor, interfaces.EStopInput)]
        for stub, iface in pairs:
            self.assertTrue(issubclass(stub, iface))

    def test_arm_refuses_targets_out_of_reach(self):
        robot = make_robot()
        with self.assertRaises(interfaces.HardwareFault):
            robot.hw.arms["right"].move_to(7.0, 5.0)

    def test_gripper_cannot_lift_overweight_object(self):
        robot = make_robot()
        box = robot.world.objects["heavy box"]
        robot.world.robot_pose.x, robot.world.robot_pose.y = box.x - 0.4, box.y
        robot.hw.arms["right"].move_to(box.x, box.y)
        self.assertIsNone(robot.hw.grippers["right"].close())
        self.assertIn("too heavy", robot.hw.grippers["right"].last_error)

    def test_camera_failure(self):
        robot = make_robot()
        robot.hw.camera.failed = True
        with self.assertRaises(interfaces.HardwareFault):
            robot.hw.camera.detect_objects()

    def test_simulated_module_exports(self):
        self.assertTrue(hasattr(simulated, "SimDriveBase"))


if __name__ == "__main__":
    unittest.main()
