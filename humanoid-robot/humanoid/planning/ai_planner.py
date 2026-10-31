"""AI / large-language-model task planner.  *** NOT IMPLEMENTED ***

Plan for the future:
  * Send the instruction plus a description of the world (known objects,
    places, robot abilities) to an AI model.
  * Ask it to answer ONLY with JSON matching humanoid.core.actions.ACTION_SCHEMA.
  * Convert the JSON into Action objects.
  * Pass the result through SafetyController.check_plan() exactly like the
    rule-based planner. The AI never gets direct motor access.
  * Fall back to the rule-based planner when offline.

This needs an API key and internet access, so it is left out of v0.1 on
purpose: the rule-based planner is predictable and fully testable.
"""

from __future__ import annotations

from humanoid.core.actions import Plan


class AIPlanner:
    available = False

    def plan(self, instruction: str, **_) -> Plan:
        raise NotImplementedError("NOT IMPLEMENTED YET: AI planner (see docs/ROADMAP.md, Stage 4).")
