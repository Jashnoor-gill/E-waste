"""Raspistill-based capture helper for Raspberry Pi (fallback when OpenCV not installed).

Requirements:
 - raspistill installed (comes with raspistill camera tools on Raspberry Pi OS)

Usage:
  python3 iot/pi_capture_raspistill.py --out Photos/capture.png
"""
import argparse
import subprocess
from pathlib import Path
import datetime


def capture(out_path: Path, timeout=2):
    out_path.parent.mkdir(parents=True, exist_ok=True)
    # raspistill options: -o output, -t timeout(ms), -w width -h height
    cmd = ['raspistill', '-o', str(out_path), '-w', '1280', '-h', '720', '-n', '-t', str(int(timeout*1000))]
    subprocess.run(cmd, check=True)
    return str(out_path)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--out', default=None)
    args = p.parse_args()
    if args.out:
        out = Path(args.out)
    else:
        ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    out = Path(__file__).resolve().parent.parent / 'Model' / 'Model' / 'Photos' / f'captured_image_{ts}.jpg'
    path = capture(out)
    print(path)


if __name__ == '__main__':
    main()
