import json
import unittest
import urllib.error
import urllib.request

from tests.helpers import make_robot
from humanoid.dashboard.server import DashboardServer


class DashboardTests(unittest.TestCase):
    def setUp(self):
        self.robot = make_robot()
        self.server = DashboardServer(self.robot, "127.0.0.1", 0)
        self.server.start_background()
        self.base = f"http://127.0.0.1:{self.server.port}"

    def tearDown(self):
        self.server.shutdown()

    def req(self, path, body=None, token=None):
        data = json.dumps(body).encode() if body is not None else None
        r = urllib.request.Request(self.base + path, data=data, method="POST" if data else "GET",
                                   headers={"Content-Type": "application/json",
                                            **({"X-Robot-Token": token} if token else {})})
        try:
            with urllib.request.urlopen(r, timeout=5) as resp:
                raw = resp.read()
                return resp.status, (json.loads(raw) if path.startswith("/api") else raw.decode())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read() or b"{}") if path.startswith("/api") else None

    def test_pages_are_served(self):
        status, html = self.req("/")
        self.assertEqual(status, 200)
        self.assertIn("STOP", html)
        self.assertEqual(self.req("/static/app.js")[0], 200)
        self.assertEqual(self.req("/static/style.css")[0], 200)
        self.assertEqual(self.req("/static/../server.py")[0], 404)

    def test_state_and_info(self):
        status, s = self.req("/api/state")
        self.assertEqual(status, 200)
        self.assertEqual(s["mode"], "idle")
        self.assertIn("world", s)
        status, info = self.req("/api/info")
        self.assertTrue(any("NOT" in f["status"].upper() or f["status"] == "placeholder" for f in info["features"]))

    def test_plan_then_execute(self):
        _, r = self.req("/api/plan", {"text": "pick up the red cup and put it in the basket"})
        self.assertTrue(r["plan"]["ok"])
        _, r2 = self.req("/api/execute", {"plan_id": r["plan"]["id"]})
        self.assertTrue(r2["ok"], r2)
        self.assertTrue(self.robot.busy)

    def test_manual_commands(self):
        _, r = self.req("/api/command", {"type": "turn", "params": {"degrees": 45}})
        self.assertTrue(r["ok"], r)
        self.req("/api/cancel", {})
        _, r = self.req("/api/command", {"type": "navigate_to", "params": {"target": "basket"}})
        self.assertTrue(r["ok"], r)
        self.req("/api/cancel", {})
        status, r = self.req("/api/command", {"type": "pick", "params": {}})
        self.assertEqual(status, 400)

    def test_stop_and_reset(self):
        self.req("/api/stop", {})
        self.assertEqual(self.robot.mode, "estopped")
        _, r = self.req("/api/reset", {})
        self.assertTrue(r["ok"])

    def test_fault_injection(self):
        _, r = self.req("/api/fault", {"code": "collision"})
        self.assertTrue(r["ok"])
        self.assertEqual(self.robot.mode, "estopped")
        self.req("/api/clear_faults", {})
        self.assertTrue(self.req("/api/reset", {})[1]["ok"])

    def test_bad_requests(self):
        self.assertEqual(self.req("/api/nope", {"x": 1})[0], 404)
        self.assertEqual(self.req("/api/execute", {"plan_id": "abc"})[0], 400)


class DashboardTokenTests(unittest.TestCase):
    def test_token_required_except_for_stop(self):
        robot = make_robot()
        server = DashboardServer(robot, "127.0.0.1", 0, token="secret123")
        server.start_background()
        base = f"http://127.0.0.1:{server.port}"
        try:
            with self.assertRaises(urllib.error.HTTPError) as cm:
                urllib.request.urlopen(base + "/api/state", timeout=5)
            self.assertEqual(cm.exception.code, 401)
            ok = urllib.request.Request(base + "/api/state", headers={"X-Robot-Token": "secret123"})
            self.assertEqual(urllib.request.urlopen(ok, timeout=5).status, 200)
            stop = urllib.request.Request(base + "/api/stop", data=b"{}", method="POST")
            self.assertEqual(urllib.request.urlopen(stop, timeout=5).status, 200)
            self.assertEqual(robot.mode, "estopped")
        finally:
            server.shutdown()


if __name__ == "__main__":
    unittest.main()
