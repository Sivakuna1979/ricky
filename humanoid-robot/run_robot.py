"""Start the robot software: simulator + control loop + browser dashboard.

    py run_robot.py                      # simulated humanoid, dashboard on this PC only
    py run_robot.py --config sim_one_arm_assistant.json
    py run_robot.py --lan                # also allow your iPhone on the same home Wi-Fi
    py run_robot.py --check-config hardware_mk1_template.json
    py run_robot.py --list-configs

Press Ctrl+C in this window to stop everything.
"""

from __future__ import annotations

import argparse
import secrets
import socket
import sys
import webbrowser
from pathlib import Path

if sys.version_info < (3, 10):
    sys.exit("Python 3.10 or newer is needed. See docs/WINDOWS_INSTALL.md")

sys.path.insert(0, str(Path(__file__).resolve().parent))

from humanoid.config.loader import ConfigError, PROJECT_ROOT, list_robot_configs, load_config  # noqa: E402
from humanoid.dashboard.server import DashboardServer  # noqa: E402
from humanoid.diagnostics import setup_logging  # noqa: E402
from humanoid.hardware.factory import HardwareNotAllowedError  # noqa: E402
from humanoid.runtime import ControlLoop, build_robot  # noqa: E402


def lan_ip() -> str:
    """Find this PC's address on the home network (no data is sent)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Run the humanoid robot simulator and dashboard.")
    ap.add_argument("--config", default="sim_humanoid.json", help="robot version config (in configs/robots)")
    ap.add_argument("--port", type=int, default=None, help="dashboard port (default 8080)")
    ap.add_argument("--lan", action="store_true",
                    help="allow phones on your home Wi-Fi to connect (protected by an access token)")
    ap.add_argument("--no-browser", action="store_true", help="don't open the browser automatically")
    ap.add_argument("--speed", type=float, default=None, help="simulation speed multiplier, e.g. 2")
    ap.add_argument("--check-config", metavar="FILE", help="only validate a config file and exit")
    ap.add_argument("--list-configs", action="store_true", help="list available robot versions")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args(argv)

    if args.list_configs:
        for name in list_robot_configs():
            cfg = load_config(name)
            print(f"{name:32} {cfg.model:18} {cfg.description}")
        return 0

    setup_logging(PROJECT_ROOT / "logs", verbose=args.verbose)

    if args.check_config:
        try:
            cfg = load_config(args.check_config)
            print(f"OK: '{cfg.source_file.name}' is valid ({cfg.model}, arms: {', '.join(cfg.arm_names)}).")
            build_robot(cfg)
            print("OK: robot can start with this config.")
            return 0
        except (ConfigError, HardwareNotAllowedError, NotImplementedError) as e:
            print(f"NOT STARTABLE: {e}")
            return 1

    try:
        robot = build_robot(args.config)
    except (ConfigError, HardwareNotAllowedError, NotImplementedError) as e:
        print(f"\nCannot start: {e}\n")
        return 1

    host = "0.0.0.0" if args.lan else robot.config.dashboard.get("host", "127.0.0.1")
    port = args.port or int(robot.config.dashboard.get("port", 8080))
    token = secrets.token_urlsafe(9) if args.lan else None
    try:
        server = DashboardServer(robot, host, port, token)
    except OSError as e:
        print(f"\nCannot open port {port} ({e}). Is the robot already running in another window? "
              f"Try: py run_robot.py --port {port + 1}\n")
        return 1

    loop = ControlLoop(robot, args.speed)
    loop.start()

    local_url = f"http://127.0.0.1:{server.port}/" + (f"?token={token}" if token else "")
    print("\n" + "=" * 64)
    print(f"  {robot.config.name} ({robot.config.model}) is running in SIMULATION")
    print(f"  Dashboard on this PC:  {local_url}")
    if args.lan:
        print(f"  Dashboard on iPhone:   http://{lan_ip()}:{server.port}/?token={token}")
        print("  (iPhone must be on the SAME Wi-Fi. Keep the token private.)")
    print("  Press Ctrl+C here to stop.")
    print("=" * 64 + "\n")
    if not args.no_browser:
        webbrowser.open(local_url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        loop.stop()
        server.httpd.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
