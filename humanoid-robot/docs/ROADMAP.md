# Development roadmap

Each stage has a clear **goal**, a **"done when"** test, and **gates** (things that
must be true before moving on). Don't skip gates. They keep you safe and stop
you wasting money.

| Stage | Name | Hardware cost | Status |
|---|---|---|---|
| 1 | Simulation foundation | £0 | **IN PROGRESS – v0.1 built** |
| 2 | Desk arm prototype | ~£300–£550 | not started |
| 3 | Mobile base + one arm | ~£900–£2,000 | not started |
| 4 | Real autonomy: mapping, vision, AI planner, ROS 2 | (Stage 3 parts) | not started |
| 5 | Two-arm humanoid upper body, voice, presentation mode | ~£1,500–£4,000 | not started |
| 6 | Household skills pilot (tidying, laundry handling, simple kitchen assistance) | varies | not started |
| 7 | Product versions, compliance, small batch | £££ | not started |

---

## Stage 1 – Simulation foundation (now)

**Built in v0.1:** dashboard (PC + iPhone), 2D simulator, task planner, software
safety controller, hardware interface layer, multi-version configs, 58 automated tests,
documentation.

**Your next learning steps (no purchase needed):**
1. Run the simulator, try every example, try to "break" the planner with odd sentences.
2. Edit `configs/worlds/home_v0.json`: add an object (e.g. `"green apple"`) and a place.
   Restart and pick it up. This teaches you JSON and configs.
3. Make a new robot version file (copy `sim_one_arm_assistant.json`) with a different speed.
4. Install **VS Code** (free) to read the code comfortably.
5. Learn Python basics: the free "Python for Everybody" course or similar (~2–4 weeks part-time).

**Next software tasks (I can build these with you):**
- Record & replay tasks; multi-room world; more sentence patterns.
- "Task library" (named routines like *tidy the living room*).
- Optional 3D simulation (PyBullet or MuJoCo) for real arm physics.

**Gate to Stage 2:** all tests pass; you can start the dashboard alone, run tasks,
trigger and reset the e-stop, and explain what the safety controller does.

## Stage 2 – Desk arm prototype

**Goal:** one real arm, bolted to a table, picks up a soft object and drops it in a box,
commanded from the same dashboard.

Work: assemble the arm kit; wire the **hardware e-stop + fuse + current-limited supply
first**; write `serial_bus_servo_arm` + `serial_bus_servo_gripper` drivers; joint
limits and torque limits in firmware; MCU watchdog; calibrate; teleoperate; then
scripted pick & place with a fixed object position; then webcam-located object.

**Done when:** 20 pick-and-place attempts in a row with no unsafe event; e-stop
tested 10× and always cuts power.
**Gate:** Stage 2 section of the safety checklist complete.

## Stage 3 – Mobile base + one arm

**Goal:** robot drives around a room under dashboard control and docks to charge.

Work: base frame, motors, LiFePO₄ battery & BMS, power distribution, bumpers,
wireless e-stop; `serial_motor_controller` driver with timeout; odometry; speed
limited to walking pace (≤0.5 m/s); test in an empty room first.

**Done when:** drives a set route 20× without hitting anything; bumpers and both
e-stops always stop it.

## Stage 4 – Real autonomy

LiDAR mapping (SLAM) and navigation (ROS 2 + Nav2 via `integrations/ros2_bridge.py`);
camera object detection with an AI vision model; depth camera for 3D positions;
AI language-model planner (`planning/ai_planner.py`) that outputs the **same** Action
format and passes the **same** safety checks; iPhone monitoring improvements.

**Done when:** "bring the blue cup from the kitchen table to the sofa" works in a real
room 8 times out of 10, safely failing (stopping and asking) the other 2.

## Stage 5 – Humanoid upper body, voice, presentation mode

Second arm and hands; torso with lifting column; head with cameras, mic array,
speaker and display. **Voice:** speech recognition + text-to-speech in **English and
Tamil**; spoken commands go through the same planner. **Presentation mode** for
business events: scripted speech, gestures, display content, visitor Q&A, with a
safety zone around the robot.

## Stage 6 – Household skills pilot

In order of difficulty / risk: tidying objects into containers → carrying laundry
baskets, loading a washing machine → folding (very hard) → wiping surfaces → simple,
cold kitchen assistance (fetching items, loading a dishwasher). Hot or sharp kitchen
work stays disabled until a formal risk assessment says otherwise.

## Stage 7 – Product & company

Define product versions (e.g. *Event/Presentation*, *Home Assistant*, *Business
Reception*) using the config system. Design for manufacture. Compliance (UKCA/CE,
machinery, electrical, radio, ISO 13482 risk assessment). Secure remote access and
signed **over-the-air updates**, fleet diagnostics, customer support. Pilot customers,
insurance, then small batch.

## Cross-cutting (every stage)

- Every new feature gets automated tests.
- Diagnostic logs for every run (`logs/robot.log`).
- Keep `docs/SIMULATED_VS_REAL.md` honest.
- Nothing is bought, connected to mains/motors, or exposed to the internet without your approval.
