# Initial bill of materials (UK price estimates)

> **DO NOT BUY ANYTHING YET.** Stage 1 (simulation) costs £0. These are planning
> estimates from typical UK retail prices (Amazon UK, The Pi Hut, Pimoroni, RS, eBay,
> AliExpress) as known at the time of writing. Prices change, so check them before buying.
> We'll pick exact models together, with links, when you're ready for each stage.

All prices include VAT and are rough ranges.

---

## Stage 1 – Simulation (now)

| Item | Qty | Est. price | Notes |
|---|---|---|---|
| Your Windows PC | 1 | £0 | Already have |
| Your iPhone | 1 | £0 | Already have |
| Python, Git, VS Code | – | £0 | Free software |
| **Stage 1 total** | | **£0** | |

## Stage 2 – Desk prototype: one real arm on a table (~£300–£550)

Goal: make **one** real, small, low-power arm pick up a sponge, controlled by this software.

| Item | Qty | Est. price | Notes |
|---|---|---|---|
| Open-source 6-DOF servo arm kit (SO-101-style, follower arm, with 6 serial bus servos) | 1 | £120–£250 | Small, light, well documented, large community |
| Serial bus servo driver board (USB) | 1 | £10–£25 | Often included in kits |
| Power supply for servos (correct voltage for the servos, e.g. 7.4 V or 12 V, 5 A) | 1 | £15–£30 | Must match servo spec |
| **Bench power supply with adjustable current limit** (0–30 V, 0–5 A) | 1 | £40–£80 | Safest way to power motors during testing |
| **Red mushroom e-stop button**, latching, NC contacts | 1 | £10–£20 | Wired to cut servo power |
| Relay/contactor module rated for the servo current | 1 | £10–£25 | E-stop drives this |
| Inline blade fuse holder + fuses | 1 set | £5–£10 | |
| USB webcam, 1080p | 1 | £20–£40 | For first vision experiments |
| Microcontroller (e.g. Raspberry Pi Pico / ESP32) for watchdog | 1 | £5–£15 | |
| Multimeter | 1 | £15–£30 | Essential tool |
| Safety glasses | 1 | £5–£10 | |
| Wires, connectors, cable ties, small screwdriver set | – | £20–£40 | |
| 3D printing of brackets (online service or a friend's printer) | – | £0–£40 | Many kits print-it-yourself |
| **Stage 2 total** | | **~£300–£550** | |

## Stage 3 – Mobile base with one arm (~£900–£2,000 more)

| Item | Qty | Est. price | Notes |
|---|---|---|---|
| 2× geared DC or hub motors **with encoders** | 2 | £60–£200 | Low speed, high torque |
| Motor driver/controller (with serial control and timeout) | 1 | £30–£150 | |
| 24 V LiFePO₄ battery 10–20 Ah, with BMS | 1 | £120–£250 | Safer chemistry |
| LiFePO₄ charger | 1 | £40–£70 | |
| DC-DC converters (12 V, 5 V, 19 V) | 3 | £30–£60 | |
| Aluminium extrusion frame + brackets | – | £60–£150 | |
| Castor wheels | 2 | £10–£20 | |
| 2D LiDAR (e.g. RPLidar A1/C1 class) | 1 | £70–£120 | For mapping & navigation |
| Onboard computer: mini-PC (N100 class) **or** NVIDIA Jetson Orin Nano dev kit | 1 | £150–£300 | Jetson better for AI vision |
| Depth camera (OAK-D Lite / RealSense class) | 1 | £150–£350 | 3D object positions |
| Bumper microswitches | 4–6 | £10–£20 | Wired into e-stop chain |
| Wireless e-stop remote (industrial, latching) | 1 | £40–£100 | |
| Fuses, main switch, wiring, connectors | – | £40–£80 | |
| **Stage 3 total** | | **~£900–£2,000** | |

## Stage 4 – Two-arm humanoid upper body (~£1,500–£4,000 more)

| Item | Qty | Est. price | Notes |
|---|---|---|---|
| Second arm (same design as first) | 1 | £150–£300 | |
| Stronger arms (higher-torque servos) for ~1 kg payload | 2 | £600–£2,000 | Only after Stage 3 is reliable |
| Grippers / simple hands | 2 | £50–£400 | Dexterous hands cost far more |
| Torso frame, lifting column (adjustable height) | 1 | £150–£500 | |
| Head: pan-tilt with cameras, microphone array, speaker | 1 | £80–£250 | For voice (English/Tamil) |
| Touch screen face/display | 1 | £50–£120 | Presentation mode |
| Soft covers / padding | – | £50–£150 | |
| **Stage 4 total** | | **~£1,500–£4,000** | |

## Running total (rough)

| Up to | Cumulative estimate |
|---|---|
| Stage 1 | £0 |
| Stage 2 | £300–£550 |
| Stage 3 | £1,200–£2,550 |
| Stage 4 | £2,700–£6,550 |

Not included: tools (soldering iron £30–£60, 3D printer £200–£400 if you want your
own), spares (budget +20%), and cloud/AI service costs (likely £0–£20/month to start).
A commercial-grade product will cost much more per unit to develop (certification,
engineering staff, tooling), but much less per unit to manufacture at volume.
