"""Honest status of every capability. Shown on the dashboard and in the docs.

Status values:
    "working (simulation)" - works today in the simulator, with tests
    "placeholder"          - the code structure exists but does nothing real yet
    "not started"          - planned for a later stage
No feature is marked as working on PHYSICAL hardware yet, because no
physical hardware has been built or tested.
"""

SIM = "working (simulation)"
PLACEHOLDER = "placeholder"
NOT_STARTED = "not started"

FEATURES = [
    ("Browser dashboard (Windows + iPhone)", SIM, "Status, map, manual commands, STOP button"),
    ("2D robot simulator", SIM, "Top-down home with furniture, objects and places"),
    ("Task planner (English text -> actions)", SIM, "Rule-based; limited sentence patterns"),
    ("Software safety controller", SIM, "Software e-stop, speed/payload limits, fault handling"),
    ("Configuration for multiple robot versions", SIM, "JSON configs with 'extends'"),
    ("Path planning around furniture", SIM, "Grid A*; future: ROS 2 Nav2"),
    ("Pick and place (simulated)", SIM, "Perfect simulated vision and grasping"),
    ("Diagnostic logging", SIM, "logs/robot.log + dashboard log"),
    ("Hardware interface layer", PLACEHOLDER, "Interfaces done; real drivers NOT implemented"),
    ("Physical hardware e-stop", NOT_STARTED, "Must be wired in hardware - see docs"),
    ("Real motors / wheels", NOT_STARTED, "Stage 2"),
    ("Real robotic arms and hands (x2)", NOT_STARTED, "Stage 3"),
    ("Camera object recognition (AI vision)", NOT_STARTED, "Stage 3"),
    ("Autonomous navigation with real sensors (LiDAR/SLAM)", NOT_STARTED, "Stage 4"),
    ("AI language-model planner", PLACEHOLDER, "humanoid/planning/ai_planner.py"),
    ("ROS 2 integration", PLACEHOLDER, "humanoid/integrations/ros2_bridge.py"),
    ("English voice (speech in/out)", PLACEHOLDER, "Simulator only logs speech text"),
    ("Tamil voice (speech in/out)", PLACEHOLDER, "Accepted as text only; no speech engine"),
    ("Laundry / cleaning / kitchen help", NOT_STARTED, "Stage 5+; kitchen hazards are refused"),
    ("Business / event presentation mode", NOT_STARTED, "Stage 5"),
    ("Remote access over the internet", NOT_STARTED, "Home Wi-Fi only for now; needs security work"),
    ("Over-the-air software updates", NOT_STARTED, "Stage 6"),
]


def feature_list() -> list[dict]:
    return [{"name": n, "status": s, "notes": notes} for n, s, notes in FEATURES]
