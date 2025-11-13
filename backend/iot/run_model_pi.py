#!/usr/bin/env python3
"""Simple helper to POST a captured image to the backend run-model endpoint.

Reads an image file, encodes to base64, POSTs JSON { "image_b64": "..." }
to `BACKEND_URL + /api/iot/run-model` and prints the JSON response to stdout.

Usage:
  python3 run_model_pi.py --file /tmp/pi_capture.jpg --server https://your-backend

Dependencies: `pip install requests`
"""
import argparse
import base64
import json
import os
import sys
import requests


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--file', required=True)
    parser.add_argument('--server', default=os.environ.get('BACKEND_URL', 'https://e-waste-backend-3qxc.onrender.com/'))
    args = parser.parse_args()

    if not os.path.exists(args.file):
        print('File not found:', args.file, file=sys.stderr)
        return 2

    with open(args.file, 'rb') as f:
        b = f.read()
    b64 = base64.b64encode(b).decode('ascii')

    url = args.server.rstrip('/') + '/api/iot/run-model'
    payload = { 'image_b64': b64 }
    try:
        resp = requests.post(url, json=payload, timeout=30)
        try:
            j = resp.json()
            print(json.dumps(j))
            return 0 if resp.ok else 1
        except Exception:
            txt = resp.text
            print(txt)
            return 1
    except Exception as e:
        print('Request failed:', e, file=sys.stderr)
        return 3


if __name__ == '__main__':
    sys.exit(main())
