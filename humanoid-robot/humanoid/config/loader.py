"""Configuration system.

Each robot *version* (product variant) is a JSON file in ``configs/robots``.
A file can say ``"extends": "base.json"`` to reuse everything from another
file and only change what is different. Setting a value to ``null`` removes
it (for example, removing the left arm on a one-arm budget model).

This lets every robot version share exactly the same core software while
using different hardware.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, fields
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
ROBOT_CONFIG_DIR = PROJECT_ROOT / "configs" / "robots"
DEFAULT_CONFIG = ROBOT_CONFIG_DIR / "sim_humanoid.json"

HARDWARE_PARTS = ("drive", "arms", "grippers", "camera", "speaker", "battery", "estop_input")


class ConfigError(Exception):
    """Raised when a configuration file is missing or invalid."""


@dataclass
class SafetyLimits:
    """Software movement limits. See docs/SAFETY_AND_TESTING_CHECKLIST.md."""

    max_linear_speed_mps: float = 0.5
    max_angular_speed_dps: float = 60.0
    max_single_move_m: float = 3.0
    max_turn_deg: float = 360.0
    max_payload_kg_per_arm: float = 1.0
    max_wait_s: float = 60.0
    max_action_duration_s: float = 120.0
    min_battery_percent_to_start: float = 15.0
    critical_battery_percent: float = 5.0
    max_speech_chars: int = 300
    max_plan_steps: int = 30

    @classmethod
    def from_dict(cls, d: dict) -> "SafetyLimits":
        known = {f.name for f in fields(cls)}
        unknown = set(d) - known
        if unknown:
            raise ConfigError(f"Unknown safety limit(s): {', '.join(sorted(unknown))}")
        limits = cls(**d)
        for f in fields(cls):
            if getattr(limits, f.name) <= 0:
                raise ConfigError(f"Safety limit '{f.name}' must be greater than 0.")
        return limits


@dataclass
class RobotConfig:
    name: str
    model: str
    version: str
    description: str
    world_file: Path
    allow_real_hardware: bool
    body: dict
    hardware: dict
    limits: SafetyLimits
    dashboard: dict
    simulation: dict
    source_file: Path
    raw: dict

    @property
    def arm_names(self) -> list[str]:
        return list(self.hardware.get("arms", {}).keys())

    @property
    def uses_only_simulation(self) -> bool:
        return all(spec.get("driver") == "sim" for spec in self.iter_hardware())

    def iter_hardware(self):
        """Yield every hardware spec dict (arms/grippers are nested by side)."""
        for part in HARDWARE_PARTS:
            spec = self.hardware.get(part)
            if spec is None:
                continue
            if part in ("arms", "grippers"):
                yield from spec.values()
            else:
                yield spec

    def summary(self) -> dict:
        return {"name": self.name, "model": self.model, "version": self.version,
                "description": self.description, "arms": self.arm_names,
                "simulation_only": self.uses_only_simulation,
                "config_file": self.source_file.name}


def _deep_merge(base: dict, override: dict) -> dict:
    out = dict(base)
    for key, value in override.items():
        if value is None:
            out.pop(key, None)
        elif isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _deep_merge(out[key], value)
        else:
            out[key] = value
    return out


def _read_json(path: Path) -> dict:
    if not path.exists():
        raise ConfigError(f"Config file not found: {path}")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise ConfigError(f"{path.name} is not valid JSON (line {e.lineno}): {e.msg}") from e
    if not isinstance(data, dict):
        raise ConfigError(f"{path.name} must contain a JSON object.")
    return data


def _load_raw(path: Path, seen: tuple[Path, ...] = ()) -> dict:
    path = path.resolve()
    if path in seen:
        raise ConfigError(f"Config 'extends' loop detected at {path.name}")
    data = _read_json(path)
    parent = data.pop("extends", None)
    if parent:
        base = _load_raw(path.parent / parent, seen + (path,))
        data = _deep_merge(base, data)
    else:
        data = _deep_merge({}, data)  # strips any nulls
    return data


def load_config(path: str | Path | None = None) -> RobotConfig:
    """Load and validate a robot configuration file."""
    p = Path(path) if path else DEFAULT_CONFIG
    if not p.is_absolute() and not p.exists():
        candidate = ROBOT_CONFIG_DIR / p
        if candidate.exists():
            p = candidate
    raw = _load_raw(p)

    for key in ("name", "model", "version", "world_file", "hardware", "body"):
        if key not in raw:
            raise ConfigError(f"Config is missing required field '{key}'.")

    hw = raw["hardware"]
    for part in ("drive", "arms", "grippers", "battery", "estop_input"):
        if part not in hw:
            raise ConfigError(f"hardware.{part} is required (use driver 'none' only where allowed).")
    arms, grippers = hw.get("arms") or {}, hw.get("grippers") or {}
    if not arms:
        raise ConfigError("At least one arm is required in hardware.arms.")
    if set(arms) != set(grippers):
        raise ConfigError("Every arm needs a matching gripper (hardware.arms and hardware.grippers must use the same names).")
    for part in HARDWARE_PARTS:
        spec = hw.get(part)
        if spec is None:
            continue
        specs = spec.values() if part in ("arms", "grippers") else [spec]
        for s in specs:
            if not isinstance(s, dict) or "driver" not in s:
                raise ConfigError(f"hardware.{part} entries need a 'driver' field.")

    world_file = Path(raw["world_file"])
    if not world_file.is_absolute():
        world_file = PROJECT_ROOT / world_file
    if not world_file.exists():
        raise ConfigError(f"World file not found: {world_file}")

    body = raw["body"]
    for key in ("radius_m", "arm_reach_m", "approach_distance_m"):
        if not isinstance(body.get(key), (int, float)) or body[key] <= 0:
            raise ConfigError(f"body.{key} must be a positive number.")
    if body["approach_distance_m"] >= body["arm_reach_m"]:
        raise ConfigError("body.approach_distance_m must be smaller than body.arm_reach_m.")

    dashboard = {"host": "127.0.0.1", "port": 8080, **raw.get("dashboard", {})}
    simulation = {"tick_hz": 20, "speed_factor": 1.0, **raw.get("simulation", {})}

    return RobotConfig(
        name=str(raw["name"]), model=str(raw["model"]), version=str(raw["version"]),
        description=str(raw.get("description", "")), world_file=world_file,
        allow_real_hardware=bool(raw.get("allow_real_hardware", False)),
        body=body, hardware=hw, limits=SafetyLimits.from_dict(raw.get("limits", {})),
        dashboard=dashboard, simulation=simulation, source_file=p.resolve(), raw=raw,
    )


def list_robot_configs() -> list[str]:
    return sorted(f.name for f in ROBOT_CONFIG_DIR.glob("*.json") if f.name != "base.json")


def describe(value: Any) -> str:  # pragma: no cover - convenience for CLI
    return json.dumps(value, indent=2, default=str)
