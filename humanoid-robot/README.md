# Humanoid Robot – Software Project (v0.1, simulation only)

This is the start of your general-purpose humanoid robot. **Today it runs as a
simulation on your computer**: a virtual robot in a virtual home that you control
from a web page on your Windows PC or your iPhone.

> **Honest status:** no physical robot exists yet. Everything that moves happens
> inside the simulator. Cooking, laundry, cleaning, real vision and voice are **not
> built yet**. The dashboard's "What works today" panel and
> [docs/SIMULATED_VS_REAL.md](docs/SIMULATED_VS_REAL.md) list exactly what
> works and what doesn't.

---

## What you can do right now

| You can... | How |
|---|---|
| See the robot, furniture and objects on a live map | Open the dashboard |
| Type instructions like *"Pick up the red cup and place it in the basket"* | "Tell the robot what to do" box → **Make a plan** → **Run plan** |
| Drive the robot with arrow buttons, send it to places, make it "speak" | "Manual control" panel |
| Press a big red **STOP** button at any time | Bottom-right corner |
| Pretend parts have failed (motor overheat, camera failure…) to test the safety system | "Safety" panel |
| Control it from your iPhone on your home Wi-Fi | `start_robot_with_iphone.bat` |
| Run 58 automated tests that check it all still works | `run_tests.bat` |

## Quick start (Windows)

Full step-by-step guide with screenshots-in-words: **[docs/WINDOWS_INSTALL.md](docs/WINDOWS_INSTALL.md)**.

Short version:

1. Install **Python 3.12 or newer** from python.org (tick **"Add python.exe to PATH"**).
2. Download this project (GitHub → **Code** → **Download ZIP**, or `git clone`) and
   switch to the branch `claude/humanoid-robot-project-b5cilm`.
3. Open the `humanoid-robot` folder → `scripts` → double-click **`start_robot.bat`**.
4. Your browser opens the dashboard at `http://127.0.0.1:8080/`.
5. To stop it, close the black window or press **Ctrl + C** in it.

No extra packages are needed. The project uses only Python's built-in libraries.

## How the software is organised

```
humanoid-robot/
├── run_robot.py               ← START HERE: launches simulator + dashboard
├── configs/
│   ├── robots/                ← one file per robot VERSION (product variant)
│   │   ├── base.json                   shared settings
│   │   ├── sim_humanoid.json           two-arm humanoid (simulated)   [default]
│   │   ├── sim_one_arm_assistant.json  budget one-arm model (simulated)
│   │   └── hardware_mk1_template.json  first real prototype (LOCKED, drivers not written)
│   └── worlds/home_v0.json    ← the virtual home: rooms, furniture, objects
├── humanoid/                  ← the robot software (Python package)
│   ├── core/          robot.py = the controller that runs actions tick by tick
│   ├── planning/      English sentence → list of safe, structured actions
│   ├── safety/        software e-stop, limits, fault handling
│   ├── hardware/      interfaces + simulated parts + placeholders for real parts
│   ├── simulation/    the virtual world
│   ├── navigation/    path planning around furniture (A*)
│   ├── dashboard/     web server + web page (HTML/CSS/JS)
│   ├── voice/         English/Tamil speech — placeholder, NOT IMPLEMENTED
│   └── integrations/  ROS 2 bridge — placeholder, NOT IMPLEMENTED
├── tests/                     ← automated tests
├── scripts/                   ← double-click .bat files for Windows
└── docs/                      ← guides, hardware plan, parts list, roadmap, safety
```

### How a command flows through the system

```
 You type / tap / (future: speak)
          │
          ▼
 Task planner ──► structured Actions  (navigate_to, pick, place, move, turn, speak…)
          │
          ▼
 Safety controller checks EVERY action (e-stop? battery? too heavy? too far? forbidden?)
          │  refused → you see the reason
          ▼
 Robot controller runs the action in small steps, 20× per second
          │  (STOP can interrupt between any two steps)
          ▼
 Hardware interfaces ──► simulated parts today  /  real motors, arms, camera later
```

The key design rule: **nothing — not the dashboard, not a future AI model — can
move a motor without going through the safety controller.** Swapping the
simulator for real hardware is a config change, not a rewrite.

## Robot versions (one core, many products)

```
py run_robot.py --list-configs
py run_robot.py --config sim_one_arm_assistant.json
```

Every version shares the same code. A version file only lists what's different
(for example, the one-arm model removes the left arm and lowers the speed).

## Running the tests

Double-click `scripts\run_tests.bat`, or in a terminal inside `humanoid-robot`:

```
py -m unittest discover -s tests -t . -v
```

The last line should say `OK`. What the tests check is listed in
[docs/SAFETY_AND_TESTING_CHECKLIST.md](docs/SAFETY_AND_TESTING_CHECKLIST.md).

## Sentences the planner understands (v0.1)

- `pick up the red cup and place it in the basket`
- `bring the blue ball to the laundry basket`
- `grab the towel, then put it on the kitchen counter`
- `go to the kitchen` / `go home` / `go charge`
- `move forward 1.5 metres` / `move back 20 cm` / `turn left 45 degrees` / `turn around`
- `say "Hello, welcome to my company"` / `say in tamil "vanakkam"` (text only)
- `wait 3 seconds`

Things it **refuses on purpose**: knives, stove, oven, boiling liquids, chemicals,
medicine, contact with children, lifting people, throwing. Things it says are
**not implemented yet**: cooking, cleaning, laundry, folding, doors, stairs,
presentation mode.

## Documents

| Document | What it's for |
|---|---|
| [WINDOWS_INSTALL.md](docs/WINDOWS_INSTALL.md) | Step-by-step setup on Windows + iPhone |
| [HARDWARE_ARCHITECTURE.md](docs/HARDWARE_ARCHITECTURE.md) | How the physical robot will be built, including safety wiring |
| [BILL_OF_MATERIALS.md](docs/BILL_OF_MATERIALS.md) | Parts list with UK price estimates (**do not buy yet**) |
| [ROADMAP.md](docs/ROADMAP.md) | Staged plan from simulation to product |
| [SAFETY_AND_TESTING_CHECKLIST.md](docs/SAFETY_AND_TESTING_CHECKLIST.md) | What must be true before each stage |
| [SIMULATED_VS_REAL.md](docs/SIMULATED_VS_REAL.md) | Exactly what is simulated vs physically real |

## Safety rules for this project

1. The dashboard only listens on your own PC unless you start it with `--lan`.
   Never expose it to the internet.
2. Software safety is **not enough** for a real robot. Before any real motor is
   powered, a **physical e-stop that cuts motor power in hardware** must be fitted
   (see the hardware doc).
3. `hardware_mk1_template.json` is locked (`allow_real_hardware: false`) and its
   drivers are deliberately not written. Don't unlock it until the Stage 2 checklist is done.
