"""
Simple Raspberry Pi client example that registers with the backend Socket.IO server,
listens for capture/run_model events and responds by sending a base64 JPEG back.

Requirements on Pi (install via pip):
  pip install "python-socketio[client]" requests

Environment variables:
  BACKEND_WS    e.g. http://your-backend.example.com (will be used by socket.io client)
  DEVICE_NAME   optional, e.g. raspi-1
  DEVICE_TOKEN  optional, token to authenticate registration
  MODEL_SERVICE_URL optional, if provided the Pi will POST images to this URL to run the model

This script is intentionally simple so you can adapt the capture method (raspistill, picamera, USB camera) to your hardware.
"""
import os
import time
import base64
import subprocess
import requests
import socketio

BACKEND_WS = os.environ.get('BACKEND_WS', 'http://127.0.0.1:5000')
DEVICE_NAME = os.environ.get('DEVICE_NAME', f'raspi-{int(time.time())}')
DEVICE_TOKEN = os.environ.get('DEVICE_TOKEN', '')
MODEL_SERVICE_URL = os.environ.get('MODEL_SERVICE_URL', '')

sio = socketio.Client(reconnection=True, logger=False, engineio_logger=False)


def capture_image_to_file(out_path='capture.jpg'):
    """Try raspistill (Raspberry Pi) and fallback to a placeholder/sample.jpg in repo."""
    # Try raspistill
    if shutil_which('raspistill'):
        cmd = ['raspistill', '-o', out_path, '-w', '640', '-h', '480', '-t', '1000']
        try:
            subprocess.run(cmd, check=True)
            return out_path
        except Exception:
            pass
    # Fallback: use a sample file if present
    sample = os.path.join(os.path.dirname(__file__), '..', 'tmp.jpg')
    if os.path.exists(sample):
        from shutil import copyfile
        copyfile(sample, out_path)
        return out_path
    # No capture available
    raise RuntimeError('No capture method available (install raspistill or provide tmp.jpg)')


def shutil_which(cmd):
    from shutil import which
    return which(cmd) is not None


def image_file_to_b64(path):
    with open(path, 'rb') as f:
        return base64.b64encode(f.read()).decode('ascii')


@sio.event
def connect():
    print('Connected to backend at', BACKEND_WS)
    # register device
    sio.emit('register_device', { 'name': DEVICE_NAME, 'token': DEVICE_TOKEN })


@sio.on('register_success')
def on_register_success(data):
    print('Register success:', data)


@sio.on('register_error')
def on_register_error(data):
    print('Register error:', data)


@sio.on('capture')
def on_capture(payload):
    print('Capture requested', payload)
    reqid = payload.get('requestId')
    try:
        img_path = capture_image_to_file()
        b64 = image_file_to_b64(img_path)
        # send back via socket
        sio.emit('iot-photo', { 'requestId': reqid, 'image_b64': b64, 'device': DEVICE_NAME })
        print('Sent iot-photo via socket')
    except Exception as e:
        print('Capture failed', e)


@sio.on('run_model')
def on_run_model(payload):
    print('Run model requested', payload)
    reqid = payload.get('requestId')
    try:
        img_path = capture_image_to_file()
        b64 = image_file_to_b64(img_path)
        # If MODEL_SERVICE_URL provided, call it and then emit iot-model-result
        if MODEL_SERVICE_URL:
            j = requests.post(MODEL_SERVICE_URL, json={'image_b64': b64}, timeout=30).json()
            result = { 'requestId': reqid, 'label': j.get('label'), 'confidence': j.get('confidence'), 'device': DEVICE_NAME }
            sio.emit('iot-model-result', result)
            print('Posted to model service and emitted result')
        else:
            # Fallback: emit mock result
            mock = { 'requestId': reqid, 'label': 'mock-device', 'confidence': 0.5, 'device': DEVICE_NAME }
            sio.emit('iot-model-result', mock)
            print('Emitted mock model result')
    except Exception as e:
        print('Run model failed', e)


def main():
    print('Pi client starting. BACKEND_WS=', BACKEND_WS, 'DEVICE_NAME=', DEVICE_NAME)
    sio.connect(BACKEND_WS)
    try:
        sio.wait()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
