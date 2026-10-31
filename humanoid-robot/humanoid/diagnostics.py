"""Diagnostic logging: a log file on disk + recent messages for the dashboard."""

from __future__ import annotations

import logging
import logging.handlers
import time
from collections import deque
from pathlib import Path


class MemoryLogHandler(logging.Handler):
    """Keeps the most recent log lines in memory so the dashboard can show them."""

    def __init__(self, capacity: int = 200):
        super().__init__(level=logging.INFO)
        self.records: deque[dict] = deque(maxlen=capacity)
        self._seq = 0

    def emit(self, record: logging.LogRecord) -> None:
        self._seq += 1
        self.records.append({"seq": self._seq, "time": record.created, "level": record.levelname,
                             "source": record.name.replace("humanoid.", ""),
                             "message": record.getMessage()})

    def recent(self, limit: int = 50) -> list[dict]:
        return list(self.records)[-limit:]


_memory = MemoryLogHandler()
_configured = False


def memory_handler() -> MemoryLogHandler:
    return _memory


def setup_logging(log_dir: Path | None = None, verbose: bool = False) -> None:
    """Send logs to the console, the dashboard, and (optionally) logs/robot.log."""
    global _configured
    root = logging.getLogger("humanoid")
    root.setLevel(logging.DEBUG if verbose else logging.INFO)
    if _configured:
        return
    root.addHandler(_memory)
    console = logging.StreamHandler()
    console.setFormatter(logging.Formatter("%(asctime)s %(levelname)-7s %(name)s: %(message)s", "%H:%M:%S"))
    root.addHandler(console)
    if log_dir is not None:
        log_dir.mkdir(parents=True, exist_ok=True)
        fh = logging.handlers.RotatingFileHandler(log_dir / "robot.log", maxBytes=2_000_000,
                                                  backupCount=5, encoding="utf-8")
        fh.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
        root.addHandler(fh)
    _configured = True
    root.info("Logging started %s", time.strftime("%Y-%m-%d %H:%M:%S"))


# Make the dashboard log work even if setup_logging() was never called (e.g. tests).
logging.getLogger("humanoid").addHandler(_memory)
logging.getLogger("humanoid").setLevel(logging.INFO)
