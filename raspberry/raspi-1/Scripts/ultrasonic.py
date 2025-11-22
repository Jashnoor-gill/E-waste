#!/usr/bin/env python3
"""
Ultrasonic sensor monitor (simple). Place in `raspberry/raspi-1/Scripts/` and run from
the project root (`/home/dprpi/E-waste/raspberry/raspi-1`).

Configuration:
- Set `BIN_UPDATE_URL` env var to the backend endpoint (e.g. https://.../api/bin/update)
- Or set `BACKEND_URL` to the backend base and this script will append `/api/bin/update`.

This script reads multiple gpiozero DistanceSensor devices and POSTs JSON updates.
"""
from __future__ import annotations

import os
import time
import requests
from gpiozero import DistanceSensor

# ================== CONFIGURATION ==================

# Backend endpoint where data will be sent. Prefer setting as env var.
BIN_UPDATE_URL = os.environ.get('BIN_UPDATE_URL') or os.environ.get('BACKEND_BIN_UPDATE_URL') or os.environ.get('BACKEND_URL')
if BIN_UPDATE_URL and BIN_UPDATE_URL.endswith('/'):
    BIN_UPDATE_URL = BIN_UPDATE_URL[:-1]
# If a plain backend base URL was provided, append the default path
if BIN_UPDATE_URL and BIN_UPDATE_URL.count('/') <= 3:
    BIN_UPDATE_URL = BIN_UPDATE_URL + '/api/bin/update'

UPDATE_INTERVAL = float(os.environ.get('UPDATE_INTERVAL', '2.0'))

# Ultrasonic sensor config
# Use BCM pin numbers. Customize these entries for your hardware.
BINS_CONFIG = [
    {
        'bin_id': 'bin_1',
        'trigger_pin': 27,
        'echo_pin': 22,
        'empty_distance_cm': 45.0,
        'full_distance_cm': 16.0,
    },
    {
        'bin_id': 'bin_2',
        'trigger_pin': 23,
        'echo_pin': 24,
        'empty_distance_cm': 50.0,
        'full_distance_cm': 15.0,
    },
    {
        'bin_id': 'bin_3',
        'trigger_pin': 8,
        'echo_pin': 7,
        'empty_distance_cm': 50.0,
        'full_distance_cm': 15.0,
    },
    {
        'bin_id': 'bin_4',
        'trigger_pin': 6,
        'echo_pin': 13,
        'empty_distance_cm': 50.0,
        'full_distance_cm': 20.0,
    },
    {
        'bin_id': 'bin_5',
        'trigger_pin': 19,
        'echo_pin': 26,
        'empty_distance_cm': 50.0,
        'full_distance_cm': 15.0,
    },
]


def create_sensors():
    sensors = []
    for cfg in BINS_CONFIG:
        try:
            sensor = DistanceSensor(echo=cfg['echo_pin'], trigger=cfg['trigger_pin'], max_distance=2.0, queue_len=5)
            sensors.append((cfg, sensor))
        except Exception as e:
            print(f"[ultrasonic] failed to init sensor {cfg.get('bin_id')}: {e}")
    return sensors


def distance_to_percentage(current_cm, empty_cm, full_cm):
    if empty_cm == full_cm:
        return 0.0
    ratio = (empty_cm - current_cm) / (empty_cm - full_cm)
    ratio = max(0.0, min(1.0, ratio))
    return ratio * 100.0


def send_update(bin_id, percent_full, distance_cm):
    payload = {
        'bin_id': bin_id,
        'percent_full': round(percent_full, 2) if percent_full is not None else None,
        'distance_cm': round(distance_cm, 2) if distance_cm is not None else None,
        'timestamp': time.time(),
    }

    if not BIN_UPDATE_URL:
        print('[ultrasonic] BIN_UPDATE_URL not set; payload:', payload)
        return

    try:
        resp = requests.post(BIN_UPDATE_URL, json=payload, timeout=3)
        resp.raise_for_status()
        print(f"[ultrasonic] Sent update for {bin_id}: {payload}")
    except requests.RequestException as e:
        print(f"[ultrasonic] Failed to send update for {bin_id}: {e}")


def main():
    print('Initializing ultrasonic sensors...')
    sensors = create_sensors()
    if not sensors:
        print('[ultrasonic] no sensors initialized; exiting')
        return
    print('Started bin monitoring loop. Press Ctrl+C to exit.')

    try:
        while True:
            for cfg, sensor in sensors:
                bin_id = cfg['bin_id']
                empty_cm = cfg['empty_distance_cm']
                full_cm = cfg['full_distance_cm']

                # gpiozero DistanceSensor.distance -> meters
                try:
                    distance_m = sensor.distance
                    distance_cm = distance_m * 100.0 if distance_m is not None else None
                except Exception as e:
                    print(f"[ultrasonic] read error for {bin_id}: {e}")
                    distance_cm = None

                percent_full = None
                if distance_cm is not None:
                    percent_full = distance_to_percentage(distance_cm, empty_cm, full_cm)

                print(f"{bin_id}: {distance_cm} cm -> {percent_full}% full")
                send_update(bin_id, percent_full, distance_cm)

            time.sleep(UPDATE_INTERVAL)

    except KeyboardInterrupt:
        print('\nExiting... cleaning up sensors.')
        try:
            for _, s in sensors:
                s.close()
        except Exception:
            pass


if __name__ == '__main__':
    main()
