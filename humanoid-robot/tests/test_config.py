import json
import tempfile
import unittest
from pathlib import Path

from tests.helpers import make_robot  # noqa: F401  (sets sys.path)
from humanoid.config.loader import ConfigError, list_robot_configs, load_config
from humanoid.hardware.factory import HardwareNotAllowedError
from humanoid.runtime import build_robot


class ConfigTests(unittest.TestCase):
    def test_default_config_loads(self):
        cfg = load_config()
        self.assertEqual(cfg.arm_names, ["right", "left"])
        self.assertTrue(cfg.uses_only_simulation)
        self.assertFalse(cfg.allow_real_hardware)

    def test_one_arm_version_shares_core_but_removes_left_arm(self):
        cfg = load_config("sim_one_arm_assistant.json")
        self.assertEqual(cfg.arm_names, ["right"])
        self.assertEqual(cfg.limits.max_linear_speed_mps, 0.3)
        self.assertEqual(cfg.hardware["grippers"]["right"]["max_payload_kg"], 0.5)
        robot = build_robot(cfg)
        self.assertEqual(list(robot.hw.arms), ["right"])

    def test_every_shipped_config_is_valid_json_and_loads(self):
        names = list_robot_configs()
        self.assertIn("sim_humanoid.json", names)
        for name in names:
            load_config(name)

    def test_hardware_template_is_locked(self):
        cfg = load_config("hardware_mk1_template.json")
        self.assertFalse(cfg.uses_only_simulation)
        with self.assertRaises(HardwareNotAllowedError):
            build_robot(cfg)

    def test_unlocking_hardware_still_fails_because_drivers_not_implemented(self):
        cfg = load_config("hardware_mk1_template.json")
        cfg.allow_real_hardware = True
        with self.assertRaises(NotImplementedError):
            build_robot(cfg)

    def _write(self, d, name, data):
        p = Path(d) / name
        p.write_text(json.dumps(data))
        return p

    def test_invalid_configs_give_clear_errors(self):
        base = json.loads((Path(load_config().source_file).parent / "base.json").read_text())
        base["world_file"] = str(load_config().world_file)
        with tempfile.TemporaryDirectory() as d:
            bad = dict(base, limits={"max_linear_speed_mps": -1})
            with self.assertRaisesRegex(ConfigError, "greater than 0"):
                load_config(self._write(d, "a.json", bad))
            bad = dict(base, limits={"warp_speed": 9})
            with self.assertRaisesRegex(ConfigError, "Unknown safety limit"):
                load_config(self._write(d, "b.json", bad))
            bad = json.loads(json.dumps(base))
            bad["hardware"]["grippers"].pop("left")
            with self.assertRaisesRegex(ConfigError, "matching gripper"):
                load_config(self._write(d, "c.json", bad))
            (Path(d) / "d.json").write_text("{not json")
            with self.assertRaisesRegex(ConfigError, "not valid JSON"):
                load_config(Path(d) / "d.json")
            with self.assertRaises(ConfigError):
                load_config(Path(d) / "missing.json")
            self._write(d, "loop1.json", {"extends": "loop2.json"})
            self._write(d, "loop2.json", {"extends": "loop1.json"})
            with self.assertRaisesRegex(ConfigError, "loop"):
                load_config(Path(d) / "loop1.json")


if __name__ == "__main__":
    unittest.main()
