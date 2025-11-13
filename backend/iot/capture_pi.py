#!/usr/bin/env python3
"""Capture script for Raspberry Pi Camera (CSI).

Tries to use Picamera2 (recommended on Bullseye/Bookworm). Falls back to
`libcamera-still` if Picamera2 is not available. Writes a JPEG to /tmp/pi_capture.jpg
and prints the path (so callers can run `python capture_pi.py` and read stdout).

Usage:
  python3 capture_pi.py --outfile /tmp/pi_capture.jpg
  or simply: python3 capture_pi.py

Dependencies (choose one):
  - picamera2: `sudo apt install -y python3-picamera2` (and libcamera)
  - libcamera-apps: `sudo apt install -y libcamera-apps`
"""
import argparse
import os
import sys
import time
import subprocess


def capture_with_picamera2(outfile, width=1280, height=720):
    # Picamera2 API (works on Raspberry Pi OS with libcamera + picamera2)
    try:
        from picamera2 import Picamera2
    except Exception as e:
        raise
    picam2 = Picamera2()
    config = picam2.create_still_configuration(main={'size': (width, height)})
    picam2.configure(config)
    picam2.start()
    # small warmup
    time.sleep(0.3)
    picam2.capture_file(outfile)
    picam2.stop()
    return outfile


def capture_with_libcamera(outfile, width=1280, height=720):
    # Use libcamera-still command-line tool as a fallback
    # -n disables preview, -o sets output
    cmd = ['libcamera-still', '-n', '-o', outfile, '--width', str(width), '--height', str(height), '--listen', '0', '--autofocus']
    # Not all libcamera versions support the same flags; try simpler fallback if this fails
    try:
        subprocess.check_output(cmd, stderr=subprocess.STDOUT)
        return outfile
    except Exception:
        # try minimal invocation
        cmd2 = ['libcamera-still', '-n', '-o', outfile]
        subprocess.check_call(cmd2)
        return outfile


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--outfile', default='/tmp/pi_capture.jpg')
    parser.add_argument('--width', type=int, default=1280)
    parser.add_argument('--height', type=int, default=720)
    args = parser.parse_args()

    outfile = args.outfile
    # ensure directory exists
    d = os.path.dirname(outfile)
    if d and not os.path.exists(d):
        os.makedirs(d, exist_ok=True)

    # Try Picamera2 first
    try:
        path = capture_with_picamera2(outfile, width=args.width, height=args.height)
        print(path)
        return 0
    except Exception:
        # fallback to libcamera-still
        try:
            path = capture_with_libcamera(outfile, width=args.width, height=args.height)
            print(path)
            return 0
        except Exception as e:
            print('Capture failed:', e, file=sys.stderr)
            return 2


if __name__ == '__main__':
    sys.exit(main())
