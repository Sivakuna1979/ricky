import math
import unittest

from tests.helpers import make_robot
from humanoid.core.actions import Action


class SimulationTests(unittest.TestCase):
    def setUp(self):
        self.robot = make_robot()

    def run_text(self, text, max_s=300):
        p = self.robot.plan(text)
        self.assertTrue(p.ok, p.errors)
        r = self.robot.execute_plan(p.id)
        self.assertTrue(r["ok"], r["reasons"])
        self.assertTrue(self.robot.run_until_idle(max_s), "task did not finish in time")

    def test_pick_and_place_moves_object_into_basket(self):
        self.run_text("Pick up the red cup and place it in the basket")
        cup = self.robot.world.objects["red cup"]
        self.assertEqual(cup.location, "basket")
        self.assertIsNone(cup.held_by)
        self.assertEqual(self.robot.last_error, "")
        self.assertEqual(self.robot.world.collision_count, 0)

    def test_carry_two_objects_at_once(self):
        self.run_text("pick up the towel and pick up the blue ball, then put the towel in the laundry basket "
                      "and put the blue ball in the basket")
        objs = self.robot.world.objects
        self.assertEqual(objs["towel"].location, "laundry_basket")
        self.assertEqual(objs["blue ball"].location, "basket")

    def test_navigation_around_furniture_without_collision(self):
        for place in ["kitchen", "sofa", "laundry basket", "table", "basket", "dock"]:
            self.run_text(f"go to the {place}")
        self.assertEqual(self.robot.world.collision_count, 0)

    def test_move_and_turn_are_accurate(self):
        self.run_text("move forward 1 metre then turn left 90 degrees")
        pose = self.robot.hw.drive.get_pose()
        self.assertAlmostEqual(pose.x, 1.7, delta=0.05)
        self.assertAlmostEqual(math.degrees(pose.theta), 90, delta=3)

    def test_full_turn(self):
        self.run_text("turn left 360 degrees")
        self.assertAlmostEqual(self.robot.hw.drive.get_pose().theta, 0, delta=0.05)

    def test_move_into_wall_is_refused_before_moving(self):
        r = self.robot.run_action(Action("move", {"distance_m": -1.0}, "back into wall"))
        self.assertTrue(r["ok"])
        self.robot.run_until_idle(10)
        self.assertIn("blocked", self.robot.last_error)
        self.assertEqual(self.robot.world.collision_count, 0)

    def test_speed_limit_is_respected(self):
        self.robot.run_action(Action("move", {"distance_m": 2.0}))
        start = self.robot.hw.drive.get_pose()
        max_speed = 0
        for _ in range(60):
            before = self.robot.hw.drive.get_pose()
            self.robot.step()
            after = self.robot.hw.drive.get_pose()
            max_speed = max(max_speed, math.dist((before.x, before.y), (after.x, after.y)) / self.robot.tick_dt)
        self.assertLessEqual(max_speed, self.robot.config.limits.max_linear_speed_mps + 1e-6)
        self.assertGreater(self.robot.hw.drive.get_pose().x, start.x)

    def test_speech_is_logged(self):
        self.run_text('say "hello"')
        self.assertEqual(self.robot.hw.speaker.history[-1]["text"], "hello")

    def test_charge(self):
        self.robot.sim_set_battery(40)
        self.run_text("go charge")
        self.assertGreaterEqual(self.robot.hw.battery.percent(), 99.5)
        self.assertFalse(self.robot.hw.battery.charging)

    def test_reset_world(self):
        self.run_text("Pick up the red cup and place it in the basket")
        self.robot.sim_reset_world()
        self.assertEqual(self.robot.world.objects["red cup"].location, "table")
        self.assertAlmostEqual(self.robot.hw.drive.get_pose().x, 0.7)

    def test_state_snapshot_is_json_friendly(self):
        import json
        json.dumps(self.robot.state())


if __name__ == "__main__":
    unittest.main()
