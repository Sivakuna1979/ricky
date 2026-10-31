# Windows installation guide (complete beginner)

Time needed: about 15 minutes. You will not need to buy anything.

---

## Step 1 – Install Python (one time only)

Python is the programming language the robot software is written in.

1. Open **https://www.python.org/downloads/** in your browser.
2. Click the big yellow **Download Python 3.x** button (3.12 or newer).
3. Open the downloaded file.
4. **IMPORTANT:** on the first screen, tick the box **"Add python.exe to PATH"** at the bottom.
5. Click **Install Now**. Wait. Click **Close**.

**Check it worked:**

1. Press the **Windows key**, type `cmd`, press **Enter**. A black window opens (the "Command Prompt").
2. Type `py --version` and press **Enter**.
3. You should see something like `Python 3.12.7`. If you see an error, restart the PC and try again.
   If it still fails, re-run the installer, choose **Modify**, and make sure "py launcher" is ticked.

## Step 2 – Get the project onto your PC

**Option A – Download ZIP (easiest):**

1. Go to your GitHub repository `sivakuna1979/ricky` in the browser.
2. Click the **branch** drop-down (it probably says `main`) and pick
   **`claude/humanoid-robot-project-b5cilm`**.
3. Click the green **Code** button → **Download ZIP**.
4. Open your **Downloads** folder, right-click the ZIP → **Extract All…** → choose
   somewhere easy, e.g. `C:\Robot`. Click **Extract**.
5. Inside you'll find a folder called **`humanoid-robot`**. That's the robot project.

**Option B – Git (better later, because you can pull updates):**

1. Install Git from **https://git-scm.com/download/win** (accept all defaults).
2. In Command Prompt:
   ```
   cd C:\
   git clone https://github.com/sivakuna1979/ricky.git Robot
   cd Robot
   git checkout claude/humanoid-robot-project-b5cilm
   ```

## Step 3 – Run the tests (checks everything is OK)

1. Open the `humanoid-robot` folder → open the `scripts` folder.
2. Double-click **`run_tests.bat`**.
3. Lots of lines scroll past. At the end you should see:
   ```
   Ran 58 tests in ...s
   OK
   ```
4. Press any key to close the window.

If Windows shows a blue **"Windows protected your PC"** box: click **More info** → **Run anyway**.
(These are plain text files you can open in Notepad to see exactly what they do.)

## Step 4 – Start the robot simulator and dashboard

1. In the `scripts` folder, double-click **`start_robot.bat`**.
2. A black window opens and shows:
   ```
   Ricky (R1-sim) is running in SIMULATION
   Dashboard on this PC:  http://127.0.0.1:8080/
   ```
3. Your web browser opens the dashboard automatically. If it doesn't, copy the
   address into Chrome or Edge.
4. **Keep the black window open** — it *is* the robot's brain. Closing it stops the robot.

## Step 5 – Your first robot task

1. In **"Tell the robot what to do"**, click the grey example
   *"Pick up the red cup and place it in the basket"* (or type it).
2. Read the plan it shows (4 steps) and the green **"Plan passed the safety checks"** message.
3. Click **2. Run plan**.
4. Watch the blue circle (the robot) drive to the table, grab the red cup (it appears
   in its hand), drive to the basket and drop it there. Takes about 25 seconds.
5. Now try the **STOP** button while it's moving. The robot freezes, turns red, and a
   red banner appears. Click **Reset e-stop** in the Safety panel to continue.

Things to try next:
- *"Pick up the heavy box"* → refused: too heavy for the arm.
- *"Cook dinner"* → refused: not implemented yet.
- In the Safety panel choose **motor overheat** → **Simulate fault** → watch the e-stop trigger.
  Then **Clear faults** → **Reset e-stop**.
- **Reset simulation** puts everything back where it started.

## Step 6 – Use your iPhone (optional, home Wi-Fi only)

1. Close the robot window if it's running.
2. Double-click **`start_robot_with_iphone.bat`**.
3. Windows may ask **"Allow Python to communicate on networks?"** → tick **Private networks**
   only (NOT public) → **Allow**.
4. The black window shows a line like:
   ```
   Dashboard on iPhone:   http://192.168.1.23:8080/?token=Ab3dE...
   ```
5. Make sure your iPhone is on the **same Wi-Fi** as the PC (not mobile data).
6. Type that **whole** address (including the `?token=…` part) into Safari on the iPhone.
   Tip: email or message the link to yourself.
7. Optional: in Safari tap **Share → Add to Home Screen** for an app-like icon.

The token changes every time you start it, so an old link stops working. Anyone
can press **STOP** without the token — stopping is always allowed on purpose.

**Do not** set up port forwarding on your router or try to reach the robot from
outside your home. The dashboard isn't secure enough for the internet yet.

## Other useful commands

Open Command Prompt **inside the `humanoid-robot` folder** (in File Explorer, click the
address bar, type `cmd`, press Enter), then:

| Command | What it does |
|---|---|
| `py run_robot.py --list-configs` | Show available robot versions |
| `py run_robot.py --config sim_one_arm_assistant.json` | Run the one-arm budget model |
| `py run_robot.py --speed 3` | Simulation runs 3× faster |
| `py run_robot.py --port 8081` | Use a different port if 8080 is busy |
| `py run_robot.py --check-config hardware_mk1_template.json` | Check a config without starting (shows it's locked) |

Logs are saved in `humanoid-robot\logs\robot.log`. If something goes wrong, that file
tells us what happened.

## Troubleshooting

| Problem | Fix |
|---|---|
| `'py' is not recognized` | Python isn't installed or PATH box wasn't ticked. Re-run the installer → Modify. |
| `Cannot open port 8080` | Robot is already running in another window, or use `--port 8081`. |
| Browser shows "This site can't be reached" | The black window was closed. Start it again. |
| iPhone can't connect | Same Wi-Fi? Used the full link with the token? Allowed Python through the firewall on Private networks? |
| iPhone says "Missing or wrong access token" | You restarted the robot. Use the new link from the black window. |
