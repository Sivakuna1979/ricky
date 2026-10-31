"""The virtual world: a flat 2D floor plan with furniture, places and objects.

This is deliberately simple (top-down 2D) so it runs on any PC with no extra
software. Later stages can swap this for a 3D physics simulator such as
Gazebo or Isaac Sim through ROS 2 without changing the robot's core code.
"""

from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass, field
from pathlib import Path

from humanoid.core.geometry import Pose, distance

_WORDS = re.compile(r"[a-z0-9]+")


def _norm(text: str) -> str:
    return " ".join(_WORDS.findall(text.lower().replace("_", " ")))


@dataclass
class Obstacle:
    name: str
    x_min: float
    y_min: float
    x_max: float
    y_max: float

    def distance_to(self, x: float, y: float) -> float:
        dx = max(self.x_min - x, 0.0, x - self.x_max)
        dy = max(self.y_min - y, 0.0, y - self.y_max)
        return math.hypot(dx, dy)


@dataclass
class Location:
    name: str
    x: float
    y: float
    kind: str = "area"
    aliases: list[str] = field(default_factory=list)

    @property
    def label(self) -> str:
        return self.name.replace("_", " ")


@dataclass
class WorldObject:
    name: str
    x: float
    y: float
    mass_kg: float = 0.2
    color: str = "#888888"
    location: str | None = None
    held_by: str | None = None  # name of the arm holding it


class SimWorld:
    """Ground truth for the simulation (where everything *really* is)."""

    def __init__(self, data: dict):
        self.name = data.get("name", "world")
        self.width = float(data["width_m"])
        self.height = float(data["height_m"])
        self.obstacles = [Obstacle(**o) for o in data.get("obstacles", [])]
        self.locations = {loc["name"]: Location(**loc) for loc in data.get("locations", [])}
        self.objects = {o["name"]: WorldObject(**o) for o in data.get("objects", [])}
        start = data.get("robot_start", {})
        self.robot_pose = Pose(start.get("x", 1.0), start.get("y", 1.0),
                               math.radians(start.get("theta_deg", 0.0)))
        self.robot_radius = 0.3
        self.collision_count = 0
        self.last_collision: str | None = None
        self._initial = json.loads(json.dumps(data))

    @classmethod
    def from_file(cls, path: str | Path) -> "SimWorld":
        return cls(json.loads(Path(path).read_text(encoding="utf-8")))

    def reset(self) -> None:
        radius = self.robot_radius
        self.__init__(self._initial)
        self.robot_radius = radius

    # ---- geometry -------------------------------------------------------
    def is_free(self, x: float, y: float, clearance: float | None = None) -> bool:
        """True if a circle of `clearance` radius at (x, y) hits nothing."""
        r = self.robot_radius if clearance is None else clearance
        if x - r < 0 or y - r < 0 or x + r > self.width or y + r > self.height:
            return False
        return all(o.distance_to(x, y) >= r for o in self.obstacles)

    def what_is_hit(self, x: float, y: float) -> str:
        r = self.robot_radius
        if x - r < 0 or y - r < 0 or x + r > self.width or y + r > self.height:
            return "wall"
        for o in self.obstacles:
            if o.distance_to(x, y) < r:
                return o.name
        return "nothing"

    def move_robot(self, new_pose: Pose) -> bool:
        """Move the robot if the new spot is free. Returns False on collision."""
        if not self.is_free(new_pose.x, new_pose.y):
            self.collision_count += 1
            self.last_collision = self.what_is_hit(new_pose.x, new_pose.y)
            return False
        self.robot_pose = new_pose
        for obj in self.objects.values():
            if obj.held_by:
                obj.x, obj.y = new_pose.x, new_pose.y
        return True

    # ---- name lookup (used by the task planner) ------------------------
    def match_location(self, phrase: str) -> list[Location]:
        p = _norm(phrase)
        if not p:
            return []
        exact = [loc for loc in self.locations.values()
                 if p == _norm(loc.name) or p in (_norm(a) for a in loc.aliases)]
        if exact:
            return exact
        return [loc for loc in self.locations.values()
                if any(_norm(a) in p for a in [loc.name, *loc.aliases])]

    def match_object(self, phrase: str) -> list[WorldObject]:
        p = _norm(phrase)
        if not p:
            return []
        exact = [o for o in self.objects.values() if p == _norm(o.name)]
        if exact:
            return exact
        words = set(p.split())
        return [o for o in self.objects.values()
                if set(_norm(o.name).split()) <= words or words <= set(_norm(o.name).split())]

    def objects_near(self, x: float, y: float, radius: float) -> list[WorldObject]:
        return sorted((o for o in self.objects.values()
                       if not o.held_by and distance(x, y, o.x, o.y) <= radius),
                      key=lambda o: distance(x, y, o.x, o.y))

    def to_dict(self) -> dict:
        return {
            "name": self.name, "width_m": self.width, "height_m": self.height,
            "obstacles": [o.__dict__ for o in self.obstacles],
            "locations": [{"name": l.name, "label": l.label, "x": l.x, "y": l.y, "kind": l.kind}
                          for l in self.locations.values()],
            "objects": [{**o.__dict__, "x": round(o.x, 3), "y": round(o.y, 3)}
                        for o in self.objects.values()],
            "collisions": self.collision_count,
        }
