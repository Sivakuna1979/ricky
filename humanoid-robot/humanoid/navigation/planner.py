"""Grid-based A* path planner.

Turns "go from here to there" into a list of waypoints that keep the robot's
body clear of furniture and walls. This is a simple stand-in; on the real
robot this role will be filled by ROS 2 Nav2 with a live map from LiDAR/SLAM.
"""

from __future__ import annotations

import heapq
import math

from humanoid.simulation.world import SimWorld


class GridPlanner:
    def __init__(self, world: SimWorld, resolution: float = 0.1, margin: float = 0.05):
        self.world = world
        self.res = resolution
        self.clearance = world.robot_radius + margin
        self.cols = int(round(world.width / resolution))
        self.rows = int(round(world.height / resolution))
        self._free = [[world.is_free(self._cx(c), self._cy(r), self.clearance)
                       for c in range(self.cols)] for r in range(self.rows)]

    def _cx(self, c: int) -> float:
        return (c + 0.5) * self.res

    def _cy(self, r: int) -> float:
        return (r + 0.5) * self.res

    def _cell(self, x: float, y: float) -> tuple[int, int]:
        c = min(self.cols - 1, max(0, int(x / self.res)))
        r = min(self.rows - 1, max(0, int(y / self.res)))
        return r, c

    def _nearest_free(self, cell: tuple[int, int], max_radius: int = 15):
        r0, c0 = cell
        if self._free[r0][c0]:
            return cell
        best = None
        for rad in range(1, max_radius + 1):
            for r in range(r0 - rad, r0 + rad + 1):
                for c in range(c0 - rad, c0 + rad + 1):
                    if 0 <= r < self.rows and 0 <= c < self.cols and self._free[r][c]:
                        d = math.hypot(r - r0, c - c0)
                        if best is None or d < best[0]:
                            best = (d, (r, c))
            if best:
                return best[1]
        return None

    def plan(self, start: tuple[float, float], goal: tuple[float, float]) -> list[tuple[float, float]] | None:
        """Return waypoints from start to (near) goal, or None if unreachable."""
        s = self._nearest_free(self._cell(*start), 4)
        g = self._nearest_free(self._cell(*goal))
        if s is None or g is None:
            return None
        moves = [(-1, 0, 1), (1, 0, 1), (0, -1, 1), (0, 1, 1),
                 (-1, -1, 1.414), (-1, 1, 1.414), (1, -1, 1.414), (1, 1, 1.414)]
        open_heap = [(0.0, s)]
        came: dict = {s: None}
        cost = {s: 0.0}
        while open_heap:
            _, cur = heapq.heappop(open_heap)
            if cur == g:
                break
            for dr, dc, step in moves:
                nr, nc = cur[0] + dr, cur[1] + dc
                if not (0 <= nr < self.rows and 0 <= nc < self.cols) or not self._free[nr][nc]:
                    continue
                if dr and dc and not (self._free[cur[0] + dr][cur[1]] and self._free[cur[0]][cur[1] + dc]):
                    continue  # don't cut corners
                new_cost = cost[cur] + step
                if new_cost < cost.get((nr, nc), math.inf):
                    cost[(nr, nc)] = new_cost
                    came[(nr, nc)] = cur
                    h = math.hypot(nr - g[0], nc - g[1])
                    heapq.heappush(open_heap, (new_cost + h, (nr, nc)))
        if g not in came:
            return None
        cells = []
        node = g
        while node is not None:
            cells.append(node)
            node = came[node]
        cells.reverse()
        points = [(self._cx(c), self._cy(r)) for r, c in cells]
        return self._smooth([start, *points[1:]])

    def _line_free(self, a, b) -> bool:
        steps = max(1, int(math.dist(a, b) / (self.res / 2)))
        for i in range(steps + 1):
            t = i / steps
            x, y = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
            r, c = self._cell(x, y)
            if not self._free[r][c]:
                return False
        return True

    def _smooth(self, pts):
        """Remove unnecessary zig-zag waypoints (keep straight-line shortcuts)."""
        if len(pts) <= 2:
            return pts[1:] if len(pts) == 2 else pts
        out, i = [], 0
        while i < len(pts) - 1:
            j = len(pts) - 1
            while j > i + 1 and not self._line_free(pts[i], pts[j]):
                j -= 1
            out.append(pts[j])
            i = j
        return out
