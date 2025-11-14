#!/usr/bin/env python3
"""Send a captured image file to the backend frame endpoint.

Usage:
  from send_frame import send
  send('/path/to/image.png', server='https://e-waste-backend-3qxc.onrender.com', device='pi_home')
"""
import base64
import os
import requests

DEFAULT_SERVER = os.environ.get('BACKEND_URL', 'https://e-waste-backend-3qxc.onrender.com')
DEFAULT_DEVICE = os.environ.get('DEVICE_ID', 'pi_home')


def send(image_path, server=DEFAULT_SERVER, device=DEFAULT_DEVICE, timeout=10):
    if not os.path.exists(image_path):
        raise FileNotFoundError(image_path)
    with open(image_path, 'rb') as f:
        b = f.read()
    b64 = base64.b64encode(b).decode('ascii')
    # normalize server base to frame endpoint
    base = server.rstrip('/')
    if '/api/frame' in base:
        url = base.rstrip('/') + '/upload_frame'
    else:
        url = base + '/api/frame/upload_frame'

    payload = {'device_id': device, 'frame': b64}
    headers = {'Content-Type': 'application/json'}
    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=timeout)
        resp.raise_for_status()
        return resp.json()
    except Exception:
        # rethrow so caller can log or handle
        raise
