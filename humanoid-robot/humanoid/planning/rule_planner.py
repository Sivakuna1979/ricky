"""Rule-based task planner: plain English -> safe, structured Action list.

Example:
    "Pick up the red cup and place it in the basket" ->
        1. navigate_to  red cup
        2. pick         red cup  (right arm)
        3. navigate_to  basket
        4. place        red cup  -> basket

How it works (simple on purpose, so it is predictable and testable):
  1. Refuse anything on the safety "forbidden topics" list.
  2. Refuse capabilities that are not built yet (cooking, laundry...).
  3. Split the sentence into clauses ("and", "then", commas).
  4. Match each clause against known patterns.
  5. Look up objects/places in the robot's world model.
  6. Keep track of which arm holds what, so "it" makes sense.

LIMITATIONS (be honest): it only understands the sentence patterns below,
English only. A future AI language model can replace step 3-4, but its
output MUST still be converted into these same Actions and pass the same
SafetyController checks. See humanoid/planning/ai_planner.py.
"""

from __future__ import annotations

import re

from humanoid.core.actions import Action, Plan
from humanoid.safety.controller import FORBIDDEN_TOPICS
from humanoid.simulation.world import SimWorld

NOT_YET_IMPLEMENTED = {
    "cook": "Cooking", "fry": "Cooking", "chop": "Food preparation", "cut": "Cutting",
    "wash": "Washing", "laundry": "Laundry", "fold": "Folding clothes", "iron": "Ironing",
    "clean": "Cleaning", "vacuum": "Vacuuming", "mop": "Mopping", "wipe": "Wiping surfaces",
    "open the door": "Opening doors", "open door": "Opening doors", "stairs": "Using stairs",
    "present": "Presentation mode", "presentation": "Presentation mode",
    "follow me": "Person following", "recognise": "Face/person recognition",
    "recognize": "Face/person recognition", "translate": "Translation",
}

NUMBER_WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
                "seven": 7, "eight": 8, "nine": 9, "ten": 10, "half": 0.5, "a": 1, "an": 1}

PRONOUNS = {"it", "that", "this", "them", "the object", "the item"}
_ARTICLES = re.compile(r"\b(the|a|an|my|your|some|please|robot|ricky)\b")
_SPLIT = re.compile(r"\s*(?:,|;|(?<!\d)\.(?!\d)|\band then\b|\bthen\b|\bafter that\b|\band\b)\s*")


def _clean(phrase: str) -> str:
    return re.sub(r"\s+", " ", _ARTICLES.sub(" ", phrase)).strip()


def _number(text: str) -> float | None:
    text = text.strip()
    try:
        return float(text)
    except ValueError:
        return NUMBER_WORDS.get(text)


class RuleBasedPlanner:
    def __init__(self, world: SimWorld, arm_names: list[str], approach_distance_m: float):
        self.world = world
        self.arm_names = list(arm_names)
        self.approach = approach_distance_m

    # ------------------------------------------------------------------
    def plan(self, instruction: str, held: dict[str, str | None] | None = None) -> Plan:
        """`held` = what each arm holds right now, e.g. {"right": "red cup"}."""
        plan = Plan(instruction=instruction)
        text = instruction.strip()
        if not text:
            plan.errors.append("Please type an instruction, e.g. 'pick up the red cup and put it in the basket'.")
            return plan

        quotes: list[str] = []

        def stash(m):
            quotes.append(m.group(1) or m.group(2))
            return f" __q{len(quotes) - 1}__ "

        low = re.sub(r"\"([^\"]*)\"|'([^']*)'", stash, text).lower()
        # "say hello there" without quotes: keep the rest of the sentence as speech
        m = re.match(r"^\s*(?:please\s+)?(?:say|speak)(?:\s+in\s+(english|tamil))?\s+(?!.*__q)(.+)$", low)
        if m:
            quotes.append(text[len(text) - len(m.group(2)):].strip())
            low = f"say {'in ' + m.group(1) + ' ' if m.group(1) else ''}__q{len(quotes) - 1}__"

        for word, reason in FORBIDDEN_TOPICS.items():
            if re.search(rf"\b{re.escape(word)}s?\b", low):
                plan.errors.append(f"Refused for safety: this version is not allowed to do {reason}.")
                return plan
        # Ignore the names of known places/objects (e.g. "laundry basket") here.
        verbs_only = low
        names = [*self.world.objects] + [n for l in self.world.locations.values() for n in [l.name, *l.aliases]]
        for name in sorted((n for n in names if " " in n or "_" in n), key=len, reverse=True):
            verbs_only = verbs_only.replace(name.replace("_", " ").lower(), " ")
        for word, feature in NOT_YET_IMPLEMENTED.items():
            if re.search(rf"\b{re.escape(word)}", verbs_only):
                plan.errors.append(f"NOT IMPLEMENTED YET: {feature} is a future capability "
                                   "(see docs/ROADMAP.md). The robot cannot do this today.")
                return plan
        if re.fullmatch(r"\s*(emergency\s+)?stop\s*(now|robot)?\s*!*\s*", low):
            plan.errors.append("To stop the robot, press the big red STOP button. "
                               "Typed text is never used as the emergency stop.")
            return plan

        state = {"held": dict(held or {a: None for a in self.arm_names}), "last_object": None}
        for clause in [c for c in _SPLIT.split(low) if c and c.strip()]:
            clause = clause.strip()
            # "pick X and place it" splits fine; "say __q0__" too.
            try:
                self._handle_clause(clause, quotes, state, plan)
            except _PlanError as e:
                plan.errors.append(str(e))
                break
        if not plan.steps and not plan.errors:
            plan.errors.append("I did not understand that. Try: 'go to the kitchen', "
                               "'pick up the red cup and put it in the basket', 'turn left', "
                               "'move forward 1 metre', 'say hello'.")
        return plan

    # ------------------------------------------------------------------
    def _handle_clause(self, clause: str, quotes: list[str], state: dict, plan: Plan) -> None:
        add = plan.steps.append

        # speak ---------------------------------------------------------
        m = re.match(r"^(?:please\s+)?(?:say|speak)(?:\s+in\s+(english|tamil))?\s+__q(\d+)__$", clause)
        if m:
            lang = "ta" if m.group(1) == "tamil" else "en"
            text = quotes[int(m.group(2))]
            if lang == "ta":
                plan.warnings.append("Tamil speech output is NOT IMPLEMENTED yet; the simulator only logs the text.")
            add(Action("speak", {"text": text, "language": lang}, f'Say "{text}"'))
            return

        c = _clean(clause)

        # charge ---------------------------------------------------------
        if re.match(r"^(?:go\s+)?(?:re)?charge(?:\s+yourself|\s+battery)?$", c) or c in ("go charge", "dock"):
            dock = self._find_dock()
            add(Action("navigate_to", {"target": dock, "target_kind": "location", "purpose": "charging"},
                       f"Go to {dock.replace('_', ' ')}"))
            add(Action("charge", {}, "Charge the battery"))
            return

        # wait -----------------------------------------------------------
        m = re.match(r"^wait(?:\s+for)?\s+([\d.]+|[a-z]+)\s*(?:seconds?|secs?|s)?$", c)
        if m:
            n = _number(m.group(1))
            if n is None:
                raise _PlanError(f"I don't know how long '{m.group(1)}' is.")
            add(Action("wait", {"seconds": n}, f"Wait {n:g} s"))
            return

        # turn -----------------------------------------------------------
        if re.match(r"^turn\s+around$", c):
            add(Action("turn", {"degrees": 180}, "Turn around"))
            return
        m = re.match(r"^(?:turn|rotate)\s+(left|right)(?:\s+(?:by\s+)?([\d.]+|[a-z]+)\s*(?:degrees?|deg)?)?$", c)
        if m:
            deg = _number(m.group(2)) if m.group(2) else 90
            if deg is None:
                raise _PlanError(f"I don't understand the angle '{m.group(2)}'.")
            signed = deg if m.group(1) == "left" else -deg
            add(Action("turn", {"degrees": signed}, f"Turn {m.group(1)} {deg:g} degrees"))
            return

        # move forward/back ---------------------------------------------
        m = re.match(r"^(?:move|go|drive|walk|step)\s+(forwards?|ahead|backwards?|back)"
                     r"(?:\s+(?:by\s+)?([\d.]+|[a-z]+)\s*(m|metres?|meters?|cm|centimetres?|centimeters?)?)?$", c)
        if m:
            n = _number(m.group(2)) if m.group(2) else 0.5
            if n is None:
                raise _PlanError(f"I don't understand the distance '{m.group(2)}'.")
            if m.group(3) and m.group(3).startswith("c"):
                n /= 100
            sign = -1 if m.group(1).startswith("back") else 1
            add(Action("move", {"distance_m": sign * n},
                       f"Move {'back' if sign < 0 else 'forward'} {n:g} m"))
            return

        # bring X to Y ---------------------------------------------------
        m = re.match(r"^(?:bring|take|carry|move|put away)\s+(.+?)\s+(?:to|into|in|onto|on|over to)\s+(.+)$", c)
        if m and not re.match(r"^(?:take|move)\s+(?:a\s+)?(?:look|step)", c):
            obj = self._resolve_object(m.group(1), state)
            self._pick(obj, state, plan)
            self._place(obj, m.group(2), state, plan)
            return

        # place / put ----------------------------------------------------
        m = re.match(r"^(?:place|put|drop|leave|set|release)\s+(?:(.+?)\s+)?(?:down\s+)?"
                     r"(?:in|into|on|onto|inside|at|in to|on to|next to|by)\s+(.+)$", c)
        if m:
            obj = self._resolve_held(m.group(1), state)
            self._place(obj, m.group(2), state, plan)
            return

        # pick -------------------------------------------------------------
        m = re.match(r"^(?:pick\s+up|pick|grab|grasp|lift|get|fetch|take|collect|hold)\s+(?:up\s+)?(.+?)(?:\s+up)?$", c)
        if m:
            obj = self._resolve_object(m.group(1), state)
            self._pick(obj, state, plan)
            return

        # navigate -------------------------------------------------------
        m = re.match(r"^(?:go|move|drive|walk|head|navigate|come|return)\s*(?:back\s+)?(?:to|towards|over to|into)?\s*(.+)$", c)
        if m and m.group(1):
            target = m.group(1).strip()
            if target in ("home", "back", "base"):
                target = self._find_dock()
            locs = self.world.match_location(target)
            if len(locs) == 1:
                add(Action("navigate_to", {"target": locs[0].name, "target_kind": "location"},
                           f"Go to {locs[0].label}"))
                return
            objs = self.world.match_object(target)
            if len(objs) == 1 and not objs[0].held_by:
                add(Action("navigate_to", {"target": objs[0].name, "target_kind": "object"},
                           f"Go to the {objs[0].name}"))
                return
            if len(locs) > 1:
                raise _PlanError(f"'{target}' could mean: {', '.join(l.label for l in locs)}. Please be specific.")
            raise _PlanError(f"I don't know a place called '{target}'. Known places: "
                             + ", ".join(l.label for l in self.world.locations.values()))

        raise _PlanError(f"I did not understand the part '{clause}'.")

    # ------------------------------------------------------------------
    def _find_dock(self) -> str:
        for loc in self.world.locations.values():
            if loc.kind == "dock":
                return loc.name
        raise _PlanError("This world has no charging dock.")

    def _resolve_object(self, phrase: str, state: dict) -> str:
        phrase = _clean(phrase)
        if phrase in PRONOUNS:
            if state["last_object"]:
                return state["last_object"]
            raise _PlanError(f"I don't know what '{phrase}' refers to. Please name the object.")
        matches = self.world.match_object(phrase)
        if not matches:
            known = ", ".join(self.world.objects) or "none"
            raise _PlanError(f"I can't find '{phrase}'. Objects I know about: {known}.")
        if len(matches) > 1:
            raise _PlanError(f"Which one do you mean: {', '.join(o.name for o in matches)}?")
        return matches[0].name

    def _resolve_held(self, phrase: str | None, state: dict) -> str:
        held = [o for o in state["held"].values() if o]
        if not phrase or _clean(phrase) in PRONOUNS:
            if state["last_object"] and state["last_object"] in held:
                return state["last_object"]
            if len(held) == 1:
                return held[0]
            if not held:
                raise _PlanError("I am not holding anything to put down.")
            raise _PlanError(f"I am holding {', '.join(held)}. Which one should I put down?")
        name = self._resolve_object(phrase, state)
        if name not in held:
            raise _PlanError(f"I am not holding the {name}. Pick it up first.")
        return name

    def _pick(self, obj: str, state: dict, plan: Plan) -> None:
        if obj in state["held"].values():
            plan.warnings.append(f"Already holding the {obj}.")
            state["last_object"] = obj
            return
        if self.world.objects[obj].held_by:
            raise _PlanError(f"The {obj} is already being held.")
        free = [a for a in self.arm_names if state["held"].get(a) is None]
        if not free:
            raise _PlanError("Both hands are full. Put something down first."
                             if len(self.arm_names) > 1 else "My hand is full. Put something down first.")
        arm = free[0]
        plan.steps.append(Action("navigate_to", {"target": obj, "target_kind": "object"}, f"Go to the {obj}"))
        plan.steps.append(Action("pick", {"object": obj, "arm": arm}, f"Pick up the {obj} with the {arm} hand"))
        state["held"][arm] = obj
        state["last_object"] = obj

    def _place(self, obj: str, location_phrase: str, state: dict, plan: Plan) -> None:
        phrase = _clean(location_phrase)
        locs = self.world.match_location(phrase)
        if not locs:
            raise _PlanError(f"I don't know a place called '{phrase}'. Known places: "
                             + ", ".join(l.label for l in self.world.locations.values()))
        if len(locs) > 1:
            raise _PlanError(f"'{phrase}' could mean: {', '.join(l.label for l in locs)}. Please be specific.")
        loc = locs[0]
        arm = next(a for a, o in state["held"].items() if o == obj)
        plan.steps.append(Action("navigate_to", {"target": loc.name, "target_kind": "location"}, f"Go to {loc.label}"))
        plan.steps.append(Action("place", {"object": obj, "location": loc.name, "arm": arm},
                                 f"Put the {obj} in/on the {loc.label}"))
        state["held"][arm] = None
        state["last_object"] = obj


class _PlanError(Exception):
    pass
