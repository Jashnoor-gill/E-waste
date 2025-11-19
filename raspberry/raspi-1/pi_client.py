#!/usr/bin/env python3
"""
Simple Raspberry Pi client wrapper for the E-Waste backend.
Usage:
  python3 pi_client.py --server https://e-waste-backend-3qxc.onrender.com --name raspi-1 --token <DEVICE_TOKEN>

Features:
- Registers device via socket.io
- Listens for `run_model` events and runs local classification using the Scripts/classify_image.py helper
- Emits `iot-model-result` with the inference result

This is a lightweight, example implementation — adapt to your hardware (GPIO / servos) as needed.
"""
import argparse
import base64
import json
import os
import sys
import time

try:
    import socketio
except Exception:
    print('Please install python-socketio: pip install python-socketio requests')
    raise

# Try to import local classify helper from nearby Scripts folder
SCRIPT_DIR = os.path.join(os.path.dirname(__file__), 'Scripts')
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

try:
    from classify_image import run_inference_from_path, run_inference_from_pil
except Exception:
    # provide fallback stub
    def run_inference_from_path(path, model_path=None):
        return {'label': 'unknown', 'confidence': 0.5}

    def run_inference_from_pil(pil_image, model_path=None):
        return {'label': 'unknown', 'confidence': 0.5}


sio = socketio.Client(reconnection=True, reconnection_attempts=5)

args = None
model_path_default = os.path.join(os.path.dirname(__file__), 'Model', 'new_layer4_resnet50_ewaste_traced.pt')


@sio.event
def connect():
    print('Connected to server as socket id', sio.sid)
    # Register device
    token = args.token or os.environ.get('DEVICE_TOKEN') or os.environ.get('DEVICE_TOKENS')
    reg = {'name': args.name}
    if token:
        reg['token'] = token
    sio.emit('register_device', reg)


@sio.on('register_success')
def on_register_success(data):
    print('Register success:', data)


@sio.on('register_error')
def on_register_error(data):
    print('Register error:', data)


@sio.on('run_model')
def on_run_model(payload):
    print('run_model event received:', payload)
    requestId = payload.get('requestId')
    params = payload.get('params') or {}
    # If params contain an image (image_b64) use it, else capture from camera or use test image
    image_b64 = params.get('image_b64') if params else None
    result = None
    try:
        if image_b64:
            from PIL import Image
            from io import BytesIO
            data = base64.b64decode(image_b64)
            img = Image.open(BytesIO(data)).convert('RGB')
            result = run_inference_from_pil(img, model_path=args.model)
        else:
            # Prefer capturing from attached camera using OpenCV if available
            try:
                import cv2
                cap = cv2.VideoCapture(0)
                ret, frame = cap.read()
                cap.release()
                if ret:
                    # convert BGR to RGB and use PIL
                    from PIL import Image
                    import numpy as np
                    img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                    result = run_inference_from_pil(img, model_path=args.model)
                else:
                    print('Camera capture failed, falling back to sample image')
            except Exception as e:
                print('OpenCV not available or camera error:', e)

        if result is None:
            # fallback to running inference on a test image if present
            sample = os.path.join(os.path.dirname(__file__), 'sample.jpg')
            if os.path.exists(sample):
                result = run_inference_from_path(sample, model_path=args.model)
            else:
                result = {'label': 'unknown', 'confidence': 0.5}

    except Exception as e:
        print('Inference error:', e)
        result = {'label': 'error', 'confidence': 0.0, 'error': str(e)}

    payload_out = {'requestId': requestId, 'device': args.name, 'label': result.get('label'), 'confidence': float(result.get('confidence', 0.0))}
    try:
        sio.emit('iot-model-result', payload_out)
        print('Emitted iot-model-result', payload_out)
    except Exception as e:
        print('Failed to emit model result:', e)


@sio.on('disconnect')
def on_disconnect():
    print('Disconnected from server')


def main():
    global args
    parser = argparse.ArgumentParser()
    parser.add_argument('--server', default=os.environ.get('SERVER_URL', 'https://e-waste-backend-3qxc.onrender.com'))
    parser.add_argument('--name', default=os.environ.get('DEVICE_NAME', 'raspi-1'))
    parser.add_argument('--token', default=os.environ.get('DEVICE_TOKEN', ''))
    parser.add_argument('--model', default=os.environ.get('MODEL_PATH', model_path_default))
    args = parser.parse_args()

    print('Starting Pi client, connecting to', args.server)
    try:
        sio.connect(args.server, transports=['websocket'])
        sio.wait()
    except Exception as e:
        print('Connection error:', e)
        time.sleep(5)
        sys.exit(1)


if __name__ == '__main__':
    main()
