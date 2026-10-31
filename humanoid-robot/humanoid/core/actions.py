"""Structured actions: the only language the robot's executor understands.

Every source of commands (dashboard buttons, the task planner, a future AI
model, a future voice system) must produce these Action objects. Every Action
is checked by the SafetyController before it runs. This is deliberate: an AI
model must never be able to move motors directly.
"""

from __future__ import annotations

import itertools
from dataclasses import dataclass, field
from typing import Any

# action type -> (required params, short human description)
ACTION_SCHEMA: dict[str, tuple[tuple[str, ...], str]] = {
    "navigate_to": (("target",), "Drive to a named place or object"),
    "move": (("distance_m",), "Drive straight forward (+) or backward (-)"),
    "turn": (("degrees",), "Turn on the spot (+ = left, - = right)"),
    "pick": (("object", "arm"), "Pick up an object with one arm"),
    "place": (("object", "location", "arm"), "Put a held object at a place"),
    "speak": (("text",), "Say something out loud"),
    "wait": (("seconds",), "Wait for a few seconds"),
    "charge": ((), "Charge the battery at the charging dock"),
}

MOTION_ACTIONS = {"navigate_to", "move", "turn", "pick", "place", "charge"}

_ids = itertools.count(1)


@dataclass
class Action:
    type: str
    params: dict[str, Any] = field(default_factory=dict)
    description: str = ""
    id: int = field(default_factory=lambda: next(_ids))

    def validate_shape(self) -> list[str]:
        """Check the action is well-formed (not whether it is *safe*)."""
        if self.type not in ACTION_SCHEMA:
            return [f"Unknown action type '{self.type}'."]
        required, _ = ACTION_SCHEMA[self.type]
        return [f"Action '{self.type}' is missing parameter '{p}'."
                for p in required if p not in self.params]

    def to_dict(self) -> dict:
        return {"id": self.id, "type": self.type, "params": self.params,
                "description": self.description or self.type}


@dataclass
class Plan:
    """The output of the task planner: a list of actions + any problems."""

    instruction: str
    steps: list[Action] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    id: int = field(default_factory=lambda: next(_ids))

    @property
    def ok(self) -> bool:
        return not self.errors and bool(self.steps)

    def to_dict(self) -> dict:
        return {"id": self.id, "instruction": self.instruction, "ok": self.ok,
                "steps": [s.to_dict() for s in self.steps],
                "errors": self.errors, "warnings": self.warnings}
