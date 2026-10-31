# What is simulated vs physically implemented

**Physically implemented today: nothing.** No motors, sensors or robot body exist
yet. Everything below runs in software on your PC.

| Capability | Status | Where | Notes / limitations |
|---|---|---|---|
| Browser dashboard (Windows + iPhone) | ✅ Working (real software) | `humanoid/dashboard/` | Home Wi-Fi only; not internet-safe |
| Robot simulator (2D top-down home) | ✅ Working – simulation | `humanoid/simulation/` | Flat 2D world, no real physics |
| Task planner, English text → actions | ✅ Working – simulation | `humanoid/planning/rule_planner.py` | Limited sentence patterns, English only |
| Software safety controller | ✅ Working – simulation | `humanoid/safety/` | Software layer only (see checklist Part C) |
| Configuration for multiple robot versions | ✅ Working | `configs/robots/` | |
| Path planning around furniture | ✅ Working – simulation | `humanoid/navigation/` | Uses a perfect, known map |
| Pick and place | ✅ Working – **simulation only** | `humanoid/core/robot.py` | Perfect vision, perfect grasping, no physics |
| Battery & charging | ✅ Working – simulation | `SimBattery` | Charging is sped up for demos |
| Fault handling & fault injection | ✅ Working – simulation | `SafetyController` | Faults are pretend, triggered from dashboard |
| Diagnostic logging | ✅ Working (real software) | `logs/robot.log` | |
| Automated tests | ✅ Working (real software) | `tests/` | 58 tests |
| Hardware interface layer | 🟡 Interfaces done, real drivers **NOT IMPLEMENTED** | `humanoid/hardware/` | `real_stubs.py` refuse to run |
| Physical e-stop | ❌ Not built | – | Must be wired in hardware |
| Real wheels/motors | ❌ Not built | – | Stage 3 |
| Real arms & hands (x2) | ❌ Not built | – | Stage 2 (one), Stage 5 (two) |
| Camera object recognition | ❌ Not built | – | Simulator "sees" perfectly |
| Real autonomous navigation (LiDAR/SLAM) | ❌ Not built | `integrations/ros2_bridge.py` placeholder | Stage 4 |
| ROS 2 integration | ❌ Placeholder | `integrations/ros2_bridge.py` | Stage 4 |
| AI language-model planner | ❌ Placeholder | `planning/ai_planner.py` | Stage 4 |
| English voice | ❌ Placeholder | `humanoid/voice/` | Robot "speech" is only logged as text |
| Tamil voice | ❌ Placeholder | `humanoid/voice/` | Tamil text accepted, no speech engine |
| Laundry / cleaning / kitchen | ❌ Not built | – | Planner replies "NOT IMPLEMENTED YET"; knives/stove refused for safety |
| Presentation / event mode | ❌ Not built | – | Stage 5 |
| Over-the-air updates | ❌ Not built | – | Stage 7 (use `git pull` for now) |
| Remote access outside home | ❌ Not built, deliberately | – | Needs proper security first |
