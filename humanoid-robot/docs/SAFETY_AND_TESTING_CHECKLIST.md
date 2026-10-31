# Testing and safety checklist

## Part A – Automated tests (run before every change is accepted)

Run: double-click `scripts\run_tests.bat` (or `py -m unittest discover -s tests -t . -v`).
The final line must say **OK**.

| Test file | What it proves |
|---|---|
| `test_config.py` | All robot-version configs load; bad configs give clear errors; the hardware template is **locked**; unlocking it still fails because real drivers aren't written |
| `test_planner.py` | English → correct actions; two hands used correctly; dangerous tasks refused; unbuilt features say NOT IMPLEMENTED; unknown objects/places handled; typed "stop" points to the real STOP button |
| `test_safety.py` | E-stop freezes motion within one tick and latches; commands refused while engaged; reset rules; held objects not dropped; critical vs warning faults; physical e-stop button; low/critical battery; limits; collisions; action timeout |
| `test_simulation.py` | Full pick-and-place works end-to-end; carrying two objects; navigating to every place with zero collisions; move/turn accuracy; speed limit never exceeded; charging; world reset |
| `test_hardware.py` | Simulated parts implement the interfaces; real drivers are honest placeholders; arm reach limit; gripper payload limit; camera failure |
| `test_dashboard.py` | Web pages served; API works; plan → execute; manual commands; STOP/reset; fault injection; bad requests rejected; access token enforced (except STOP) |

## Part B – Manual dashboard checks (Stage 1, about 10 minutes)

- [ ] Dashboard opens on the PC and shows the map and "SIMULATION" badge.
- [ ] Example task "Pick up the red cup…" completes; cup ends up in the basket.
- [ ] STOP during movement freezes the robot immediately; banner appears; robot turns red.
- [ ] New commands are refused while stopped; **Reset e-stop** restores normal operation.
- [ ] Simulated *motor overheat*: e-stop triggers; reset is refused until **Clear faults**.
- [ ] Simulated *camera failure*: pick tasks refused, driving still allowed.
- [ ] Simulated physical e-stop ticked: reset refused until it's unticked.
- [ ] Battery set to 10%: only "go charge" is accepted; charging returns it to 100%.
- [ ] "Pick up the heavy box", "use the knife", "cook dinner" are all refused with clear reasons.
- [ ] (Optional) iPhone connects with the token link; STOP on the phone works.

## Part C – Software safety vs hardware safety

| | Software safety (built, in this repo) | Hardware safety (must be built before real motors) |
|---|---|---|
| Emergency stop | Software e-stop latch; stops commands and sets velocity to zero | Red latching e-stop that physically cuts motor power via safety relay/contactor |
| Speed | Clamped to config limits | Motor driver current/speed limits; gearing; small motors |
| Force | Payload limit check | Servo torque limits; low-power arms; mechanical compliance |
| Faults | Fault list, critical faults trigger e-stop | Fuses, BMS, thermal cut-outs |
| Lost control | Control-loop error → e-stop | MCU watchdog stops motors if commands stop |
| Collisions | Map check before moves; collision = critical fault | Bumpers wired into e-stop chain; padding |
| **Survives a crash/freeze of this PC?** | **NO** | **YES** |

## Part D – Gate checklist before Stage 2 (first real motor)

Do not power a real motor until every box is ticked **and you've approved it**.

- [ ] Part A and Part B all pass.
- [ ] Physical e-stop wired so it cuts **motor** power (not just a signal to software). Tested 10× with a multimeter.
- [ ] Inline fuse on the motor supply, rated just above normal current.
- [ ] Powered from a **current-limited bench supply** for first tests.
- [ ] Arm clamped to a sturdy table; clear 1 m zone; nothing fragile or hot nearby.
- [ ] Servo torque limits set low; joint limits configured in firmware.
- [ ] MCU watchdog tested: unplug USB → motion stops within 0.2 s.
- [ ] Safety glasses worn; nobody else (especially children or pets) in the room.
- [ ] Each new motion first tested at reduced speed with a hand on the e-stop.
- [ ] Driver code has its own automated tests (with a fake serial port).

## Part E – Additional gates before Stage 3 (moving robot)

- [ ] Wheels-off-the-ground tests first (robot on blocks).
- [ ] Max speed ≤ 0.5 m/s in config **and** limited in motor driver.
- [ ] Bumpers wired into e-stop chain; wireless e-stop tested at full room distance.
- [ ] LiFePO₄ battery with BMS; main fuse; never charged unattended.
- [ ] First drives in an empty room; no stairs accessible.

## Part F – Before any public / business demonstration

- [ ] Written risk assessment for the venue.
- [ ] Physical barrier or marked safety zone around the robot.
- [ ] A trained operator holding the wireless e-stop at all times.
- [ ] Public liability insurance covering robot demonstrations.
