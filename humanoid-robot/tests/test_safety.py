import unittest

from tests.helpers import make_robot
from humanoid.core.actions import Action


class SafetyTests(unittest.TestCase):
    def setUp(self):
        self.robot = make_robot()

    def start_long_move(self):
        r = self.robot.run_action(Action("move", {"distance_m": 2.5}, "long move"))
        self.assertTrue(r["ok"], r["reasons"])
        for _ in range(10):
            self.robot.step()
        self.assertTrue(self.robot.busy)

    def test_estop_stops_motion_immediately_and_latches(self):
        self.start_long_move()
        self.robot.emergency_stop("test")
        x = self.robot.hw.drive.get_pose().x
        for _ in range(40):
            self.robot.step()
        self.assertEqual(self.robot.hw.drive.get_pose().x, x, "robot moved after e-stop")
        self.assertEqual(self.robot.mode, "estopped")
        self.assertFalse(self.robot.busy)
        # New commands are refused while the e-stop is engaged.
        r = self.robot.run_action(Action("turn", {"degrees": 10}))
        self.assertFalse(r["ok"])
        self.assertIn("Emergency stop", r["reasons"][0])
        p = self.robot.plan("go to the kitchen")
        self.assertFalse(p.ok)

    def test_reset_after_estop(self):
        self.robot.emergency_stop("test")
        self.assertTrue(self.robot.reset()["ok"])
        self.assertEqual(self.robot.mode, "idle")
        self.assertTrue(self.robot.run_action(Action("turn", {"degrees": 10}))["ok"])

    def test_estop_keeps_held_object(self):
        p = self.robot.plan("pick up the red cup and put it in the basket")
        self.robot.execute_plan(p.id)
        for _ in range(4000):
            self.robot.step()
            if self.robot.hw.grippers["right"].held_object():
                break
        self.robot.emergency_stop("test")
        self.assertEqual(self.robot.hw.grippers["right"].held_object(), "red cup")

    def test_critical_fault_triggers_estop_and_blocks_reset(self):
        self.start_long_move()
        self.robot.inject_fault("motor_overheat")
        self.robot.step()
        self.assertEqual(self.robot.mode, "estopped")
        self.assertFalse(self.robot.reset()["ok"])
        self.robot.clear_faults()
        self.assertTrue(self.robot.reset()["ok"])

    def test_warning_fault_does_not_estop_but_blocks_vision_tasks(self):
        self.robot.inject_fault("camera_failure")
        self.robot.step()
        self.assertNotEqual(self.robot.mode, "estopped")
        p = self.robot.plan("pick up the red cup")
        self.assertFalse(p.ok)
        self.assertIn("Camera fault", " ".join(p.errors))
        self.assertTrue(self.robot.plan("go to the kitchen").ok)

    def test_physical_estop_button(self):
        self.start_long_move()
        self.robot.sim_set_physical_estop(True)
        self.robot.step()
        self.assertEqual(self.robot.mode, "estopped")
        r = self.robot.reset()
        self.assertFalse(r["ok"])
        self.assertIn("physical e-stop", " ".join(r["reasons"]))
        self.robot.sim_set_physical_estop(False)
        self.robot.step()
        self.assertTrue(self.robot.reset()["ok"])

    def test_low_battery_only_allows_charging(self):
        self.robot.sim_set_battery(10)
        self.robot.step()
        self.assertFalse(self.robot.plan("go to the kitchen").ok)
        self.assertTrue(self.robot.plan("go charge").ok)

    def test_critical_battery_estops(self):
        self.robot.sim_set_battery(3)
        self.robot.step()
        self.assertEqual(self.robot.mode, "estopped")

    def test_limits(self):
        s, ctx = self.robot.safety, self.robot._safety_ctx()
        self.assertFalse(s.check_action(Action("move", {"distance_m": 10}), ctx).allowed)
        self.assertFalse(s.check_action(Action("turn", {"degrees": 720}), ctx).allowed)
        self.assertFalse(s.check_action(Action("wait", {"seconds": 999}), ctx).allowed)
        self.assertFalse(s.check_action(Action("speak", {"text": "x" * 1000}), ctx).allowed)
        self.assertFalse(s.check_action(Action("pick", {"object": "towel", "arm": "tail"}), ctx).allowed)
        self.assertFalse(s.check_action(Action("fly", {}), ctx).allowed)
        self.assertFalse(s.check_action(Action("move", {}), ctx).allowed)
        self.assertTrue(s.check_action(Action("move", {"distance_m": 1}), ctx).allowed)
        v, w = s.limit_velocity(5.0, 10.0)
        self.assertEqual(v, self.robot.config.limits.max_linear_speed_mps)

    def test_collision_is_a_critical_fault(self):
        # Bypass the planner's map check and drive straight into the wall.
        self.robot.hw.drive.set_velocity(-0.5, 0)
        for _ in range(40):
            self.robot.hw.update(0.05)
            self.robot.step()
            if self.robot.mode == "estopped":
                break
        self.assertEqual(self.robot.mode, "estopped")
        self.assertTrue(self.robot.safety.has_fault("collision"))

    def test_action_timeout(self):
        self.robot.config.limits.max_action_duration_s = 1.0
        self.robot.run_action(Action("wait", {"seconds": 5}))
        self.robot.run_until_idle(10)
        self.assertTrue(self.robot.safety.has_fault("action_timeout"))
        self.assertEqual(self.robot.mode, "estopped")


if __name__ == "__main__":
    unittest.main()
