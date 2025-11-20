#!/usr/bin/env python3
"""
Ultrasonic sensor monitor for Raspberry Pi.

Reads one or more ultrasonic DistanceSensor devices (gpiozero) and
periodically POSTs JSON updates to the backend `BIN_UPDATE_URL`.

Configurable via environment variables:
- BIN_UPDATE_URL: full URL to POST updates to (example: https://.../api/bin/update)
- UPDATE_INTERVAL: seconds between readings (default: 10)

Each bin must be listed in `BINS_CONFIG` with keys:
- id: backend bin id
- trigger: BCM pin number for trigger pin
- echo: BCM pin number for echo pin
- empty_distance_cm: distance when bin is empty (cm)
- full_distance_cm: distance when bin is full (cm)

The script gracefully handles missing gpiozero by falling back to a stub
that returns None distances (useful for development on non-RPi machines).
"""
from __future__ import annotations

import os
import time
import json
import signal
import sys
from datetime import datetime
from typing import Dict, Any, List

try:
    from gpiozero import DistanceSensor
except Exception:
    DistanceSensor = None

import requests

# --- Configuration ---
BIN_UPDATE_URL = os.environ.get("BIN_UPDATE_URL") or os.environ.get("BACKEND_BIN_UPDATE_URL") or os.environ.get("BACKEND_URL")
if BIN_UPDATE_URL and BIN_UPDATE_URL.endswith("/"):
    BIN_UPDATE_URL = BIN_UPDATE_URL[:-1]
# Default expected path for bin updates; change if your backend uses a different route
DEFAULT_BIN_UPDATE_PATH = "/api/bin/update"
if BIN_UPDATE_URL and not BIN_UPDATE_URL.endswith(DEFAULT_BIN_UPDATE_PATH):
    # If user provided just backend URL, append endpoint
    if not BIN_UPDATE_URL.endswith("/api/bin/update") and BIN_UPDATE_URL.count("/") <= 3:
        BIN_UPDATE_URL = BIN_UPDATE_URL + DEFAULT_BIN_UPDATE_PATH

UPDATE_INTERVAL = float(os.environ.get("UPDATE_INTERVAL", "10"))

# Example BINS_CONFIG: update pins and distances to match your hardware/setup
# Distances in centimeters. Adjust empty_distance_cm and full_distance_cm for calibration.
BINS_CONFIG: List[Dict[str, Any]] = [
    {
        "id": "bin-1",
        "trigger": 23,
        "echo": 24,
        "empty_distance_cm": 80.0,
        "full_distance_cm": 10.0,
    },
    {
        "id": "bin-2",
        "trigger": 27,
        "echo": 22,
        "empty_distance_cm": 80.0,
        "full_distance_cm": 10.0,
    },
]


class SensorWrapper:
    def __init__(self, cfg: Dict[str, Any]):
        self.id = cfg["id"]
        self.trigger = cfg.get("trigger")
        self.echo = cfg.get("echo")
        self.empty_cm = float(cfg.get("empty_distance_cm", 80.0))
        self.full_cm = float(cfg.get("full_distance_cm", 10.0))

        self._sensor = None
        if DistanceSensor is not None and self.trigger is not None and self.echo is not None:
            try:
                # gpiozero DistanceSensor expects the trigger and echo pin numbers
                self._sensor = DistanceSensor(echo=self.echo, trigger=self.trigger)
            except Exception as e:
                print(f"[sensor {self.id}] failed to init DistanceSensor: {e}")
                self._sensor = None

    def read_distance_cm(self) -> float | None:
        """Return measured distance in centimeters or None if not available."""
        if self._sensor is None:
            return None
        try:
            # DistanceSensor.distance returns meters
            d_m = self._sensor.distance
            if d_m is None:
                return None
            return float(d_m) * 100.0
        except Exception:
            return None

    def compute_fill_percent(self, distance_cm: float | None) -> float | None:
        if distance_cm is None:
            return None
        # if distance is >= empty -> 0% full; <= full -> 100% full
        if distance_cm >= self.empty_cm:
            return 0.0
        if distance_cm <= self.full_cm:
            return 100.0
        # linear interpolation between empty and full
        span = self.empty_cm - self.full_cm
        if span <= 0:
            return 0.0
        filled = (self.empty_cm - distance_cm) / span * 100.0
        return max(0.0, min(100.0, filled))


def send_update(bin_id: str, distance_cm: float | None, fill_percent: float | None) -> None:
    if not BIN_UPDATE_URL:
        print("[ultrasonic] BIN_UPDATE_URL not set; skipping POST")
        return

    payload = {
        "bin_id": bin_id,
        "distance_cm": distance_cm,
        "fill_percent": fill_percent,
        "ts": datetime.utcnow().isoformat() + "Z",
    }
    try:
        resp = requests.post(BIN_UPDATE_URL, json=payload, timeout=5)
        print(f"[ultrasonic] posted {bin_id}: status={resp.status_code}")
    except Exception as e:
        print(f"[ultrasonic] failed to POST for {bin_id}: {e}")


def main_loop():
    sensors = [SensorWrapper(cfg) for cfg in BINS_CONFIG]
    print(f"[ultrasonic] monitoring {len(sensors)} bins; interval={UPDATE_INTERVAL}s; target={BIN_UPDATE_URL}")

    stop = False

    def _handle_sig(signum, frame):
        nonlocal stop
        print(f"[ultrasonic] received signal {signum}; stopping")
        stop = True

    signal.signal(signal.SIGINT, _handle_sig)
    signal.signal(signal.SIGTERM, _handle_sig)

    while not stop:
        for s in sensors:
            d = s.read_distance_cm()
            p = s.compute_fill_percent(d)
            print(f"[ultrasonic] {s.id} distance_cm={d} fill%={p}")
            send_update(s.id, d, p)
        # sleep with early exit checks
        slept = 0.0
        while slept < UPDATE_INTERVAL and not stop:
            time.sleep(0.5)
            slept += 0.5


if __name__ == "__main__":
    try:
        main_loop()
    except Exception as e:
        print(f"[ultrasonic] fatal error: {e}")
        sys.exit(1)
