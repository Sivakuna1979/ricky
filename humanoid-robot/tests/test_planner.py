import unittest

from tests.helpers import make_robot


class PlannerTests(unittest.TestCase):
    def setUp(self):
        self.robot = make_robot()

    def plan(self, text):
        return self.robot.plan(text)

    def test_pick_and_place_example(self):
        p = self.plan("Pick up the object and place it in the basket".replace("the object", "the red cup"))
        self.assertTrue(p.ok, p.errors)
        self.assertEqual([s.type for s in p.steps], ["navigate_to", "pick", "navigate_to", "place"])
        self.assertEqual(p.steps[1].params, {"object": "red cup", "arm": "right"})
        self.assertEqual(p.steps[3].params["location"], "basket")

    def test_bring_uses_both_names(self):
        p = self.plan("Bring the blue ball to the laundry basket")
        self.assertTrue(p.ok, p.errors)
        self.assertEqual(p.steps[-1].params["location"], "laundry_basket")

    def test_partial_names_and_aliases(self):
        p = self.plan("grab the cup then put it on the counter")
        self.assertTrue(p.ok, p.errors)
        self.assertEqual(p.steps[-1].params["location"], "kitchen_counter")

    def test_two_objects_use_two_hands(self):
        p = self.plan("pick up the towel and pick up the blue ball")
        self.assertTrue(p.ok, p.errors)
        arms = [s.params["arm"] for s in p.steps if s.type == "pick"]
        self.assertEqual(arms, ["right", "left"])

    def test_third_object_is_refused_when_hands_full(self):
        p = self.plan("pick up the towel, pick up the blue ball, pick up the book")
        self.assertFalse(p.ok)
        self.assertIn("hands are full", " ".join(p.errors))

    def test_one_arm_robot_has_one_hand(self):
        robot = make_robot("sim_one_arm_assistant.json")
        p = robot.plan("pick up the towel and pick up the blue ball")
        self.assertFalse(p.ok)
        self.assertIn("hand is full", " ".join(p.errors))

    def test_movement_commands(self):
        p = self.plan("move forward 1.5 metres then turn left 45 degrees, turn around and move back 20 cm")
        self.assertTrue(p.ok, p.errors)
        self.assertEqual([(s.type, list(s.params.values())[0]) for s in p.steps],
                         [("move", 1.5), ("turn", 45), ("turn", 180), ("move", -0.2)])

    def test_speech_keeps_original_text(self):
        p = self.plan('say "Hello, and Welcome"')
        self.assertTrue(p.ok, p.errors)
        self.assertEqual(p.steps[0].params["text"], "Hello, and Welcome")
        p = self.plan('say in tamil "vanakkam"')
        self.assertEqual(p.steps[0].params["language"], "ta")
        self.assertTrue(any("Tamil" in w for w in p.warnings))

    def test_dangerous_requests_are_refused(self):
        for text in ["pick up the knife", "turn on the stove", "carry the baby", "throw the ball"]:
            p = self.plan(text)
            self.assertFalse(p.ok, text)
            self.assertIn("Refused for safety", p.errors[0], text)
            self.assertEqual(p.steps, [], text)

    def test_unbuilt_features_say_not_implemented(self):
        for text in ["cook dinner", "do the laundry", "clean the kitchen", "fold the towel"]:
            p = self.plan(text)
            self.assertFalse(p.ok, text)
            self.assertIn("NOT IMPLEMENTED", p.errors[0], text)

    def test_heavy_object_fails_safety_check(self):
        p = self.plan("pick up the heavy box")
        self.assertFalse(p.ok)
        self.assertIn("weighs 8.0 kg", " ".join(p.errors))

    def test_unknown_things(self):
        self.assertIn("can't find", " ".join(self.plan("pick up the elephant").errors))
        self.assertIn("don't know a place", " ".join(self.plan("go to the moon").errors))
        self.assertIn("did not understand", " ".join(self.plan("sing a song").errors))
        self.assertFalse(self.plan("").ok)

    def test_place_without_holding_is_refused(self):
        p = self.plan("put it in the basket")
        self.assertIn("not holding", " ".join(p.errors))

    def test_typed_stop_points_to_button(self):
        p = self.plan("stop")
        self.assertIn("STOP button", p.errors[0])

    def test_charge(self):
        p = self.plan("go charge")
        self.assertEqual([s.type for s in p.steps], ["navigate_to", "charge"])


if __name__ == "__main__":
    unittest.main()
