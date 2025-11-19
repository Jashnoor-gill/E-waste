#!/usr/bin/env python3
"""
CLI helper to upload a local image file to the backend frame server.

Usage:
  python3 send_frame.py --file ./capture.jpg --device raspi-1 --server http://backend:5000
"""
import argparse
import base64
import requests
import os
import sys

p = argparse.ArgumentParser()
p.add_argument('--file', '-f', required=True)
p.add_argument('--device', '-d', default='raspi-1')
p.add_argument('--server', '-s', default=os.environ.get('EW_BACKEND_URL', 'http://127.0.0.1:5000'))
p.add_argument('--token', '-t', default=os.environ.get('DEVICE_TOKEN', ''))
args = p.parse_args()

if not os.path.exists(args.file):
    print('file not found', args.file)
    sys.exit(2)
with open(args.file, 'rb') as f:
    b = f.read()
b64 = base64.b64encode(b).decode('ascii')
url = args.server.rstrip('/') + '/api/frame/upload_frame'
headers = {'Content-Type': 'application/json'}
if args.token:
    headers['x-device-token'] = args.token
try:
    r = requests.post(url, json={'device_id': args.device, 'frame': b64}, headers=headers, timeout=10)
    print('status', r.status_code, r.text[:400])
except Exception as e:
    print('upload failed', e)
    sys.exit(3)
