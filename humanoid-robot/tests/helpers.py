import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from humanoid.runtime import build_robot  # noqa: E402


def make_robot(config="sim_humanoid.json"):
    return build_robot(config)
