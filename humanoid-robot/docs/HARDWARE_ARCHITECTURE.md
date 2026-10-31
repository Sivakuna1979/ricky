# Hardware architecture

**Status: design document. Nothing here has been built yet.**

This describes how the physical robot will be put together so the software we
already have can drive it. It is written for the first prototypes, not for a
mass-produced product.

---

## 1. Design choices for the first prototypes (and why)

| Choice | Why |
|---|---|
| **Wheeled base, not legs** | Walking humanoids are very expensive, fall over, and are hard to make safe. Almost all useful home/business tasks happen at table height. A wheeled base with a humanoid upper body (torso, two arms, head with cameras) is how most commercial "humanoid" helpers start. Legs can be a later product. |
| **Small, light, low-power arms first** | A light arm that can only lift ~0.3–0.5 kg cannot seriously hurt anyone. We learn the software on it before using stronger motors. |
| **Two computers: "brain" + "spinal cord"** | The big computer (PC / Jetson) runs AI, vision and planning, and can crash. A small microcontroller does real-time motor control and stops the motors if the brain goes silent. |
| **Hardware e-stop independent of all software** | Software has bugs. The red button must cut motor power physically. |
| **Standard parts + ROS 2 later** | Lets you swap suppliers and hire robotics engineers who already know the tools. |

## 2. Block diagram

```
                         ┌──────────────────────────────┐
   iPhone / PC  ◄─Wi-Fi─►│  HIGH-LEVEL COMPUTER          │  (Stage 2: your PC via USB)
   (dashboard)           │  "the brain"                  │  (Stage 3+: Jetson / mini-PC on robot)
                         │  this Python software:        │
                         │  planner, safety checks,      │
                         │  navigation, vision, voice    │
                         └──────┬─────────┬──────────┬───┘
                           USB  │     USB │      USB │
                 ┌──────────────┘         │          └──────────────┐
                 ▼                        ▼                         ▼
     ┌───────────────────────┐   ┌─────────────────┐     ┌─────────────────────┐
     │ MICROCONTROLLER       │   │ Cameras         │     │ LiDAR (Stage 3+)    │
     │ "spinal cord"         │   │ (RGB / depth)   │     │ microphone, speaker │
     │ - motor commands      │   └─────────────────┘     └─────────────────────┘
     │ - WATCHDOG: no message│
     │   for 0.2 s → stop    │
     │ - reads bumpers,      │
     │   e-stop status       │
     └───┬──────────┬────────┘
         │          │ serial bus
         ▼          ▼
   ┌──────────┐  ┌───────────────────────┐
   │ Wheel    │  │ Arm servos (x6 each)  │
   │ motor    │  │ + grippers            │
   │ driver   │  │ (left + right arm)    │
   └────┬─────┘  └──────────┬────────────┘
        │                   │
   ═════╪═══════════════════╪═════════  MOTOR POWER RAIL (can be cut)
        │                   │
   ┌────┴───────────────────┴─────┐
   │ SAFETY RELAY / CONTACTOR      │◄──── RED E-STOP BUTTON(S) (NC contacts)
   │ cuts motor power when ANY     │◄──── wireless e-stop remote (Stage 3+)
   │ e-stop is pressed             │◄──── bumper switches (Stage 3+)
   └────┬──────────────────────────┘
        │ fuse
   ┌────┴─────────┐        separate, always-on LOGIC POWER rail (fused) feeds
   │ BATTERY + BMS│──────► the computers so they can log what happened
   └──────────────┘
```

## 3. Safety layers (most important first)

| Layer | Type | What it does | Works if software crashes? |
|---|---|---|---|
| 1. Red mushroom e-stop → safety relay/contactor | **Hardware** | Physically cuts motor power | **Yes** |
| 2. Fuses + current-limited supply | **Hardware** | Stops fires / burnt wiring on short circuits | **Yes** |
| 3. Low-power, low-torque motors; servo torque limits | **Hardware/firmware** | An arm physically can't push hard | **Yes** |
| 4. Mechanical limits, soft covers, rounded edges | **Hardware** | Limits pinch points | **Yes** |
| 5. Microcontroller watchdog | **Firmware** | Stops motors if the brain stops talking | **Yes** (if MCU alive) |
| 6. Bumpers / proximity sensors | **Hardware + firmware** | Stop on contact | Mostly |
| 7. `SafetyController` in this repo | **Software** | Command checks, speed/payload limits, fault latching, software e-stop | **No** |
| 8. Planner refusals (knives, stove, …) | **Software** | Won't plan dangerous tasks | **No** |

Layers 7–8 are already built and tested in simulation. Layers 1–6 **must** exist
before any real motor is powered. The software only *reads* the physical e-stop
(`EStopInput`) so it can log the event and stop planning. It never *implements* it.

**Gripper on e-stop:** the software tells grippers to *keep holding* on e-stop,
because dropping a mug of tea is worse than holding it. On real hardware this
depends on the gripper (some servos go limp when power is cut). Choose
self-locking/worm-gear grippers or accept that objects may drop, and test it.

## 4. How the software maps to hardware

| Software interface (`humanoid/hardware/interfaces.py`) | Simulated today | Planned real part | Planned driver (in `real_stubs.py`) |
|---|---|---|---|
| `DriveBase` | `SimDriveBase` | 2 geared DC/hub motors with encoders + motor driver | `serial_motor_controller` |
| `Arm` (x2) | `SimArm` | 6-DOF arm from serial bus servos (open-source SO-101-style designs) | `serial_bus_servo_arm` |
| `Gripper` (x2) | `SimGripper` | Servo parallel gripper | `serial_bus_servo_gripper` |
| `Camera` | `SimCamera` (perfect vision) | USB RGB camera → later depth camera + AI detection model | `usb_camera` |
| `BatteryMonitor` | `SimBattery` | INA219/INA226 sensor or the BMS's data port | `ina219_battery_monitor` |
| `EStopInput` | `SimEStopInput` | Auxiliary contact on the e-stop button, read by the MCU | `gpio_estop_monitor` |
| `Speaker` | `SimSpeaker` (logs text) | USB speaker + text-to-speech (English, Tamil) | – |

To bring a real part online later: write the driver class, bench test it alone
with the e-stop in reach, then change one line in a config file.

## 5. Power (Stage 3+ mobile robot, indicative)

- Battery: 24 V LiFePO₄ (safer chemistry than Li-ion/LiPo), 10–20 Ah, **with built-in BMS**.
- Main fuse at the battery. Separate fused branches for motors, servos, compute.
- DC-DC converters: 24 V → 12 V (servos, depending on model), 24 V → 5 V (Pi/MCU), 24 V → 19 V (mini-PC/Jetson).
- Motor rail passes through the e-stop contactor. Logic rail does not.
- Charging via a proper LiFePO₄ charger. Never charge unattended during prototyping.

## 6. Mains / kitchen work

Kitchen tasks near hobs, kettles, knives and water are the most dangerous things
on your wish list. They are refused in software and will stay that way until the
robot has proven reliable manipulation, collision detection, and a proper risk
assessment. Never let the robot near mains-powered appliances during prototyping.

## 7. Selling robots later (things to plan for)

Selling a robot in the UK needs legal compliance work. Get professional advice before
selling anything. Likely relevant:

- **UK Supply of Machinery (Safety) Regulations 2008** and **UKCA/CE marking**
- Electrical Equipment (Safety), EMC, and Radio Equipment regulations (Wi-Fi/Bluetooth)
- **ISO 13482** (safety of personal care robots), **ISO 12100** (risk assessment), ISO 13849 (safety-related control systems)
- Battery transport and safety rules (UN 38.3 for lithium batteries)
- Product liability insurance, data protection (UK GDPR) for cameras/microphones in homes

This is one reason the architecture keeps hardware safety separate and documented from day one.
