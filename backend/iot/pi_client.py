#!/usr/bin/env python3
"""
Simple Raspberry Pi client example that registers with the backend via socket.io
and responds to `capture` and `run_model` events. Meant as a starter you can
copy to your Pi and extend to run camera capture / real inference.

Environment variables:
  BACKEND_URL - backend base URL (default: https://e-waste-backend-3qxc.onrender.com)
  DEVICE_NAME - device name to register as (default: raspi-1)
  DEVICE_TOKEN_TO_USE - optional device token if server requires one

Usage:
  BACKEND_URL='https://e-waste-backend-3qxc.onrender.com' DEVICE_NAME='raspi-1' python3 pi_client.py
"""
import os
import time
import base64
import random
import socketio

BACKEND = os.environ.get('BACKEND_URL', 'https://e-waste-backend-3qxc.onrender.com')
NAME = os.environ.get('DEVICE_NAME', 'raspi-1')
TOKEN = os.environ.get('DEVICE_TOKEN_TO_USE')

sio = socketio.Client(reconnection=True, logger=False, engineio_logger=False)


@sio.event
def connect():
    print('Connected to backend as socket id', sio.sid)
    payload = {'name': NAME}
    if TOKEN:
        payload['token'] = TOKEN
    sio.emit('register_device', payload)
    print('register_device emitted ->', payload)


@sio.on('register_success')
def on_register_success(data):
    print('Register success:', data)


@sio.on('register_error')
def on_register_error(data):
    print('Register error:', data)


@sio.on('capture')
def on_capture(data):
    print('Capture requested:', data)
    reqid = data.get('requestId')
    # Simulate capture by sending back a tiny base64 placeholder
    placeholder = base64.b64encode(b'fake-image-bytes').decode('ascii')
    payload = {'requestId': reqid, 'image_b64': placeholder}
    try:
        sio.emit('iot-photo', payload)
        print('Sent iot-photo for', reqid)
    except Exception as e:
        print('Failed to emit iot-photo:', e)


@sio.on('run_model')
def on_run_model(data):
    print('Run-model requested:', data)
    reqid = data.get('requestId')
    # Here you would run local inference. We simulate a result.
    labels = ['phone', 'laptop', 'battery', 'accessory', 'unknown']
    label = random.choice(labels)
    confidence = round(random.uniform(0.6, 0.99), 2)
    result = {'requestId': reqid, 'label': label, 'confidence': confidence}
    try:
        sio.emit('iot-model-result', result)
        print('Sent iot-model-result for', reqid, result)
    except Exception as e:
        print('Failed to emit iot-model-result:', e)


@sio.event
def disconnect():
    print('Disconnected from backend')


def main():
    print('Connecting to', BACKEND)
    try:
        sio.connect(BACKEND, transports=['websocket'])
    except Exception as e:
        print('Connection failed:', e)
        return
    # keep running
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print('Shutting down')
    finally:
        try:
            sio.disconnect()
        except Exception:
            pass


if __name__ == '__main__':
    main()
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


def attempt_register(payload, max_retries=6):
    """Attempt to register device with exponential backoff until register_success is received."""
    backoff = 1.0
    attempt = 0
    while attempt < max_retries:
        attempt += 1
        try:
            print(f'Attempting register attempt={attempt}...')
            sio.emit('register_device', payload)
            # wait for either register_success or register_error within timeout
            got = {'ok': None}

            def on_success(d):
                got['ok'] = True

            def on_error(d):
                got['ok'] = False

            sio.on('register_success', on_success)
            sio.on('register_error', on_error)

            timeout = backoff + 2
            waited = 0.0
            interval = 0.25
            while waited < timeout:
                if got['ok'] is not None:
                    break
                time.sleep(interval)
                waited += interval

            # remove handlers
            try:
                sio.off('register_success')
                sio.off('register_error')
            except Exception:
                pass

            if got['ok'] is True:
                print('Registration succeeded')
                return True
            if got['ok'] is False:
                print('Registration rejected by server')
            else:
                print('No response, will retry')
        except Exception as e:
            print('Register attempt error', e)

        time.sleep(backoff)
        backoff = min(backoff * 2, 30)

    print('Failed to register after retries')
    return False

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


@sio.on('actuate')
def on_actuate(data):
    print('Actuate command received', data)
    requestId = data.get('requestId')
    try:
        out = subprocess.check_output(['python', 'actuate.py'])
        result = out.decode().strip()
        sio.emit('iot-model-result', { 'requestId': requestId, 'result': {'actuate': result}, 'device': DEVICE_NAME })
    except Exception as e:
        print('Actuate failed', e)
        sio.emit('iot-model-result', { 'requestId': requestId, 'error': str(e), 'device': DEVICE_NAME })

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--name', default='raspi-1')
    parser.add_argument('--server', default='https://e-waste-backend-3qxc.onrender.com')
    parser.add_argument('--token', default=None, help='Device registration token (overrides DEVICE_TOKEN env)')
    args = parser.parse_args()
    DEVICE_NAME = args.name
    SERVER = args.server
    sio.connect(SERVER)
    # register device name (include token provided via CLI or env)
    register_payload = {'name': DEVICE_NAME}
    TOKEN = args.token or os.environ.get('DEVICE_TOKEN') or os.environ.get('DEVICE_TOK')
    if TOKEN:
        register_payload['token'] = TOKEN

    ok = attempt_register(register_payload)
    if not ok:
        print('Device failed to register. Exiting.')
        try:
            sio.disconnect()
        except Exception:
            pass
        raise SystemExit(1)

    print('Registered device name', DEVICE_NAME)
    try:
        sio.wait()
    except KeyboardInterrupt:
        print('Exiting')
