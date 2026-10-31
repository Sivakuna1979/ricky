"""Browser dashboard web server (uses only Python's standard library).

By default it listens on 127.0.0.1, which means ONLY this computer can open
it. Starting with --lan lets phones on your home Wi-Fi connect, protected by
a random access token printed in the console. Never expose this server to
the public internet: it has no hardened security yet.
"""

from __future__ import annotations

import hmac
import json
import logging
import mimetypes
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from humanoid.core.actions import Action
from humanoid.core.robot import Robot

log = logging.getLogger("humanoid.dashboard")
STATIC_DIR = Path(__file__).parent / "static"
MAX_BODY = 16 * 1024

MANUAL_ACTIONS = {"move", "turn", "navigate_to", "speak", "wait", "charge"}


class DashboardServer:
    def __init__(self, robot: Robot, host: str = "127.0.0.1", port: int = 8080, token: str | None = None):
        self.robot = robot
        self.token = token
        handler = _make_handler(self)
        self.httpd = ThreadingHTTPServer((host, port), handler)
        self.httpd.daemon_threads = True
        self.host, self.port = self.httpd.server_address[:2]
        self._thread: threading.Thread | None = None

    def serve_forever(self) -> None:
        self.httpd.serve_forever(poll_interval=0.25)

    def start_background(self) -> None:
        self._thread = threading.Thread(target=self.serve_forever, name="dashboard", daemon=True)
        self._thread.start()

    def shutdown(self) -> None:
        self.httpd.shutdown()
        self.httpd.server_close()

    # ---- API logic (kept separate from HTTP plumbing so it is easy to test)
    def handle_api(self, method: str, path: str, body: dict, query: dict) -> tuple[int, dict]:
        r = self.robot
        if method == "GET" and path == "/api/state":
            after = int(query.get("log_after", ["0"])[0] or 0)
            return 200, r.state(log_after=after)
        if method == "GET" and path == "/api/info":
            return 200, r.info()
        if method != "POST":
            return 404, {"ok": False, "reasons": ["Unknown endpoint"]}

        if path == "/api/stop":
            r.emergency_stop(str(body.get("reason") or "STOP button pressed on dashboard"))
            return 200, {"ok": True, "reasons": []}
        if path == "/api/cancel":
            r.cancel()
            return 200, {"ok": True, "reasons": []}
        if path == "/api/reset":
            return 200, r.reset()
        if path == "/api/plan":
            text = str(body.get("text", ""))[:500]
            return 200, {"ok": True, "plan": r.plan(text).to_dict()}
        if path == "/api/execute":
            try:
                plan_id = int(body.get("plan_id"))
            except (TypeError, ValueError):
                return 400, {"ok": False, "reasons": ["plan_id must be a number"]}
            return 200, r.execute_plan(plan_id)
        if path == "/api/command":
            kind = body.get("type")
            params = body.get("params") or {}
            if kind not in MANUAL_ACTIONS or not isinstance(params, dict):
                return 400, {"ok": False, "reasons": [f"Manual command must be one of {sorted(MANUAL_ACTIONS)}"]}
            if kind == "charge":
                plan = r.plan("go charge")
                if not plan.ok:
                    return 200, {"ok": False, "reasons": plan.errors}
                return 200, r.execute_plan(plan.id)
            desc = {"move": f"Move {params.get('distance_m')} m", "turn": f"Turn {params.get('degrees')} degrees",
                    "navigate_to": f"Go to {str(params.get('target', '')).replace('_', ' ')}",
                    "speak": f"Say \"{params.get('text', '')}\"", "wait": f"Wait {params.get('seconds')} s"}[kind]
            if kind == "navigate_to":
                params = {"target": params.get("target"), "target_kind": "location"}
                if params["target"] not in r.world.locations:
                    return 200, {"ok": False, "reasons": ["Unknown place."]}
            try:
                for key in ("distance_m", "degrees", "seconds"):
                    if key in params:
                        params[key] = float(params[key])
            except (TypeError, ValueError):
                return 400, {"ok": False, "reasons": ["Numbers expected."]}
            return 200, r.run_action(Action(kind, params, desc))
        if path == "/api/fault":
            return 200, r.inject_fault(str(body.get("code", "")))
        if path == "/api/clear_faults":
            return 200, r.clear_faults()
        if path == "/api/sim/physical_estop":
            return 200, r.sim_set_physical_estop(bool(body.get("pressed")))
        if path == "/api/sim/battery":
            try:
                return 200, r.sim_set_battery(float(body.get("percent")))
            except (TypeError, ValueError):
                return 400, {"ok": False, "reasons": ["percent must be a number"]}
        if path == "/api/sim/reset":
            return 200, r.sim_reset_world()
        return 404, {"ok": False, "reasons": ["Unknown endpoint"]}

    def token_ok(self, supplied: str | None) -> bool:
        if not self.token:
            return True
        return bool(supplied) and hmac.compare_digest(supplied, self.token)


def _make_handler(server: DashboardServer):
    class Handler(BaseHTTPRequestHandler):
        server_version = "HumanoidDashboard/0.1"

        def log_message(self, fmt, *args):  # keep the console quiet
            log.debug("%s %s", self.address_string(), fmt % args)

        def _send(self, status: int, payload: bytes, ctype: str) -> None:
            self.send_response(status)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("X-Frame-Options", "DENY")
            self.send_header("Referrer-Policy", "no-referrer")
            self.end_headers()
            self.wfile.write(payload)

        def _json(self, status: int, data: dict) -> None:
            self._send(status, json.dumps(data, default=str).encode("utf-8"), "application/json")

        def _route(self, method: str) -> None:
            url = urlparse(self.path)
            query = parse_qs(url.query)
            path = url.path
            if method == "GET" and not path.startswith("/api/"):
                return self._static(path)
            # The STOP endpoint deliberately works without a token: stopping is always safe.
            if path != "/api/stop":
                supplied = self.headers.get("X-Robot-Token") or query.get("token", [None])[0]
                if not server.token_ok(supplied):
                    return self._json(401, {"ok": False, "reasons": ["Missing or wrong access token. "
                                                                     "Open the full link shown in the console."]})
            body: dict = {}
            if method == "POST":
                length = int(self.headers.get("Content-Length") or 0)
                if length > MAX_BODY:
                    return self._json(413, {"ok": False, "reasons": ["Request too large"]})
                raw = self.rfile.read(length) if length else b""
                if raw:
                    try:
                        body = json.loads(raw.decode("utf-8"))
                    except (UnicodeDecodeError, json.JSONDecodeError):
                        return self._json(400, {"ok": False, "reasons": ["Body must be JSON"]})
                    if not isinstance(body, dict):
                        return self._json(400, {"ok": False, "reasons": ["Body must be a JSON object"]})
            try:
                status, data = server.handle_api(method, path, body, query)
            except Exception as e:  # report, don't crash the server
                log.exception("Dashboard API error")
                status, data = 500, {"ok": False, "reasons": [f"Internal error: {e}"]}
            self._json(status, data)

        def _static(self, path: str) -> None:
            name = "index.html" if path in ("/", "/index.html") else path.removeprefix("/static/")
            target = (STATIC_DIR / name).resolve()
            if STATIC_DIR.resolve() not in target.parents or not target.is_file():
                return self._send(404, b"Not found", "text/plain")
            ctype = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
            if ctype.startswith("text/") or ctype.endswith("javascript"):
                ctype += "; charset=utf-8"
            self._send(200, target.read_bytes(), ctype)

        def do_GET(self):
            self._route("GET")

        def do_POST(self):
            self._route("POST")

    return Handler
