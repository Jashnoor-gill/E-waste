"""
Simple Raspberry Pi client that connects to the backend socket.io server,
listens for 'capture' and 'run_model' commands, runs local Python scripts,
and emits back 'iot-photo' and 'iot-model-result' events.

Usage:
  python pi_client.py --name raspi-1 --server https://your-backend-url

Requires: python-socketio, requests, picamera (if using Pi Camera) or OpenCV
"""
import argparse
import base64
import json
import os
import subprocess
import time

import socketio

sio = socketio.Client()

@sio.event
def connect():
    print('Connected to server', sio.sid)

@sio.event
def disconnect():
    print('Disconnected')

@sio.on('capture')
def on_capture(data):
    print('Capture command received', data)
    requestId = data.get('requestId')
    # Call local capture.py to take a photo and return path
    try:
        out = subprocess.check_output(['python', 'capture.py'])
        photo_path = out.decode().strip()
        print('Photo saved to', photo_path)
        # Read file and send base64
        with open(photo_path, 'rb') as f:
            b64 = base64.b64encode(f.read()).decode()
        sio.emit('iot-photo', { 'requestId': requestId, 'imageBase64': b64, 'device': DEVICE_NAME })
    except Exception as e:
        print('Capture failed', e)
        sio.emit('iot-photo', { 'requestId': requestId, 'error': str(e), 'device': DEVICE_NAME })

@sio.on('run_model')
def on_run_model(data):
    print('Run model command received', data)
    requestId = data.get('requestId')
    try:
        out = subprocess.check_output(['python', 'run_model.py'])
        result = out.decode().strip()
        # Assume result is JSON or text
        try:
            parsed = json.loads(result)
        except Exception:
            parsed = { 'result': result }
        sio.emit('iot-model-result', { 'requestId': requestId, 'result': parsed, 'device': DEVICE_NAME })
    except Exception as e:
        print('Run model failed', e)
        sio.emit('iot-model-result', { 'requestId': requestId, 'error': str(e), 'device': DEVICE_NAME })

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--name', default='raspi-1')
    parser.add_argument('--server', default='https://e-waste-backend-3qxc.onrender.com')
    args = parser.parse_args()
    DEVICE_NAME = args.name
    SERVER = args.server

    sio.connect(SERVER)
    # register device name
    sio.emit('register_device', {'name': DEVICE_NAME})
    print('Registered device name', DEVICE_NAME)
    try:
        sio.wait()
    except KeyboardInterrupt:
        print('Exiting')
