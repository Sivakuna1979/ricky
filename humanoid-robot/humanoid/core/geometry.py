"""Small 2D geometry helpers. Units: metres and radians everywhere."""

from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass
class Pose:
    """Where the robot is on the floor and which way it faces."""

    x: float = 0.0
    y: float = 0.0
    theta: float = 0.0  # heading in radians, 0 = facing +x (east)

    def to_dict(self) -> dict:
        return {"x": round(self.x, 3), "y": round(self.y, 3),
                "theta": round(self.theta, 3),
                "heading_deg": round(math.degrees(self.theta), 1)}


def wrap_angle(a: float) -> float:
    """Wrap an angle to the range [-pi, pi]."""
    return (a + math.pi) % (2 * math.pi) - math.pi


def distance(x1: float, y1: float, x2: float, y2: float) -> float:
    return math.hypot(x2 - x1, y2 - y1)
