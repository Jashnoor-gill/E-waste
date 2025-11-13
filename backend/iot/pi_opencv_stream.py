#!/usr/bin/env python3
"""Pi OpenCV streamer: captures frames from a webcam and POSTs base64 JPEGs to the server.

Requirements:
  - Python 3
  - OpenCV (cv2) installed (version 4.x)
  - requests

Usage:
  python3 pi_opencv_stream.py --server https://e-waste-backend-3qxc.onrender.com/ --device raspi-1 --token your_token
"""
import argparse
import base64
import time
import os
import requests
import cv2


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--device', default=os.environ.get('DEVICE_ID', 'pi_home'))
    parser.add_argument('--server', default=os.environ.get('BACKEND_URL', 'https://e-waste-backend-3qxc.onrender.com/') )
    parser.add_argument('--token', default=None, help='Optional device token (not required for single Pi)')
    parser.add_argument('--fps', type=float, default=1.0)
    parser.add_argument('--camera', type=int, default=0)
    args = parser.parse_args()

    # allow passing the base endpoint (e.g. https://host/api/frame) or root; normalize
    base = args.server.rstrip('/')
    # If the caller passed a full path that already contains /api/frame, use it and append /upload_frame
    if '/api/frame' in base:
        url = base.rstrip('/') + '/upload_frame'
    else:
        # assume they passed the backend root; build the frame endpoint
        url = base + '/api/frame/upload_frame'
    cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        print('Failed to open camera')
        return 2

    delay = 1.0 / max(0.1, args.fps)
    print('Starting capture loop. Sending to', url)
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                print('Frame capture failed, retrying...')
                time.sleep(1)
                continue

            # encode as JPEG
            ok, buf = cv2.imencode('.jpg', frame)
            if not ok:
                print('JPEG encode failed')
                time.sleep(1)
                continue

            b64 = base64.b64encode(buf.tobytes()).decode('ascii')
            payload = {'device_id': args.device, 'frame': b64}
            headers = {'Content-Type': 'application/json'}
            if args.token:
                headers['x-device-token'] = args.token

            try:
                resp = requests.post(url, json=payload, headers=headers, timeout=10)
                if resp.ok:
                    print('Sent frame at', time.strftime('%H:%M:%S'), 'status', resp.status_code)
                else:
                    print('Server error', resp.status_code, resp.text[:200])
            except Exception as e:
                print('Request failed', e)

            time.sleep(delay)
    except KeyboardInterrupt:
        print('Exiting')
    finally:
        cap.release()


if __name__ == '__main__':
    main()
