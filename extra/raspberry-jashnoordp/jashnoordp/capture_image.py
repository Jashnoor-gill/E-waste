#!/usr/bin/env python3
"""
Capture a photo on Raspberry Pi using `raspistill` or OpenCV as fallback.
Usage: python3 capture_image.py --outfile /tmp/out.jpg
"""
import argparse
import subprocess
import os
import sys

def capture_raspistill(outfile, w=320, h=240):
    cmd = ['raspistill', '-o', outfile, '-w', str(w), '-h', str(h), '-t', '1000', '-n']
    try:
        subprocess.check_call(cmd, timeout=15)
        return True
    except Exception as e:
        print('raspistill failed:', e, file=sys.stderr)
        return False


def capture_opencv(outfile, w=320, h=240):
    try:
        import cv2
        cap = cv2.VideoCapture(0)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, w)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, h)
        ret, frame = cap.read()
        cap.release()
        if not ret:
            print('OpenCV capture failed', file=sys.stderr)
            return False
        cv2.imwrite(outfile, frame)
        return True
    except Exception as e:
        print('OpenCV capture error:', e, file=sys.stderr)
        return False


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--outfile', '-o', required=True)
    p.add_argument('--width', type=int, default=320)
    p.add_argument('--height', type=int, default=240)
    args = p.parse_args()
    out = args.outfile
    # try raspistill first
    ok = capture_raspistill(out, args.width, args.height)
    if not ok:
        ok = capture_opencv(out, args.width, args.height)
    if not ok:
        sys.exit(2)
    print(out)

if __name__ == '__main__':
    main()
