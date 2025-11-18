#!/usr/bin/env python3
"""
Raspberry Pi client for E-Waste project.

Features:
- Connects to backend via socket.io and registers as a device
- Listens for `run_model` events to capture an image, run inference, and return results
- Uploads captured frames to `/api/frame/upload_frame` so the website can display them
- Posts model results to `/api/iot/model_result` (and emits `iot-model-result` over socket.io)

Configure via environment variables or edit the constants below.
"""

import os
import sys
import time
import base64
import json
import subprocess
import requests
import socketio
from pathlib import Path

# Configuration (edit or set environment variables)
SERVER_URL = os.environ.get('EW_BACKEND_URL', 'http://127.0.0.1:5000')
DEVICE_NAME = os.environ.get('DEVICE_NAME', 'raspi-1')
DEVICE_TOKEN = os.environ.get('DEVICE_TOKEN', '')  # optional, set if backend uses DEVICE_TOKENS
CAPTURE_PATH = os.environ.get('CAPTURE_PATH', '/tmp/jashnoordp_capture.jpg')
CAPTURE_WIDTH = int(os.environ.get('CAPTURE_WIDTH', '320'))
CAPTURE_HEIGHT = int(os.environ.get('CAPTURE_HEIGHT', '240'))
USE_RASPISTILL = os.environ.get('USE_RASPISTILL', '1') == '1'
TFLITE_MODEL_PATH = os.environ.get('TFLITE_MODEL_PATH', '')
TORCH_MODEL_PATH = os.environ.get('TORCH_MODEL_PATH', '')

# Default torch model location (repo pi_model new_layer4)
if not TORCH_MODEL_PATH:
    alt = Path(__file__).resolve().parents[2] / 'pi_model' / 'DP-Group-17-' / 'Model' / 'new_layer4_resnet50_ewaste_traced.pt'
    alt2 = Path(__file__).resolve().parents[2] / 'pi_model' / 'DP-Group-17-' / 'Model' / 'resnet50_ewaste_traced.pt'
    if alt.exists():
        TORCH_MODEL_PATH = str(alt)
    elif alt2.exists():
        TORCH_MODEL_PATH = str(alt2)

# lazy torch model
_torch_model = None

def load_torch_model():
    global _torch_model
    if _torch_model is not None:
        return _torch_model
    if not TORCH_MODEL_PATH:
        return None
    try:
        import torch
        print('Loading TorchScript model from', TORCH_MODEL_PATH)
        m = torch.jit.load(TORCH_MODEL_PATH, map_location=('cuda' if torch.cuda.is_available() else 'cpu'))
        m.eval()
        _torch_model = m
        return _torch_model
    except Exception as e:
        print('Failed to load TorchScript model:', e)
        _torch_model = None
        return None

def run_local_torchscript(image_path):
    try:
        import torch
        from PIL import Image
        from torchvision import transforms
        model = load_torch_model()
        if model is None:
            return None
        DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        preprocess = transforms.Compose([
            transforms.Resize((224,224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485,0.456,0.406], std=[0.229,0.224,0.225])
        ])
        img = Image.open(image_path).convert('RGB')
        inp = preprocess(img).unsqueeze(0).to(DEVICE)
        with torch.no_grad():
            out = model(inp)
            probs = torch.nn.functional.softmax(out, dim=1)
            conf, idx = torch.max(probs, 1)
            # map to labels - prefer local labels.json if present
            labels_path = Path(__file__).resolve().parent / 'labels.json'
            if labels_path.exists():
                import json
                labels = json.load(open(labels_path))
            else:
                labels = ["Battery","Cables","Charger","Earphones","Headphones","Keyboard","Mobile","Mouse","PCBs","Printer","Remote Control","Smartwatch"]
            label = labels[idx.item()] if idx.item() < len(labels) else f'class_{idx.item()}'
            return { 'label': label, 'confidence': float(conf.item()) }
    except Exception as e:
        print('TorchScript inference failed:', e)
        return None

sio = socketio.Client(reconnection=True, logger=False, engineio_logger=False)


def capture_with_raspistill(path=CAPTURE_PATH, w=CAPTURE_WIDTH, h=CAPTURE_HEIGHT):
    try:
        cmd = ['raspistill', '-o', path, '-w', str(w), '-h', str(h), '-t', '1000', '-n']
        subprocess.check_call(cmd, timeout=10)
        with open(path, 'rb') as f:
            return f.read()
    except Exception as e:
        print('raspistill capture failed:', e)
        return None


def capture_with_opencv(path=CAPTURE_PATH, w=CAPTURE_WIDTH, h=CAPTURE_HEIGHT):
    try:
        import cv2
        cap = cv2.VideoCapture(0)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, w)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, h)
        ret, frame = cap.read()
        cap.release()
        if not ret:
            return None
        cv2.imwrite(path, frame)
        with open(path, 'rb') as f:
            return f.read()
    except Exception as e:
        print('OpenCV capture failed:', e)
        return None


def b64_from_bytes(b):
    return base64.b64encode(b).decode('ascii')


def upload_frame_to_server(device_id, b64frame):
    url = SERVER_URL.rstrip('/') + '/api/frame/upload_frame'
    headers = { 'Content-Type': 'application/json' }
    if DEVICE_TOKEN:
        headers['x-device-token'] = DEVICE_TOKEN
    body = { 'device_id': device_id, 'frame': b64frame }
    try:
        r = requests.post(url, json=body, headers=headers, timeout=10)
        print('upload_frame:', r.status_code, r.text[:200])
        return r.ok
    except Exception as e:
        print('upload_frame failed:', e)
        return False


def post_model_result(device_id, result):
    url = SERVER_URL.rstrip('/') + '/api/iot/model_result'
    headers = { 'Content-Type': 'application/json' }
    if DEVICE_TOKEN:
        headers['x-device-token'] = DEVICE_TOKEN
    body = { 'device_id': device_id, 'result': result }
    try:
        r = requests.post(url, json=body, headers=headers, timeout=10)
        print('model_result POST:', r.status_code, r.text[:200])
        return r.ok
    except Exception as e:
        print('post_model_result failed:', e)
        return False


def run_local_model_stub(image_bytes):
    import random
    labels = ['phone', 'laptop', 'battery', 'accessory', 'unknown']
    label = random.choice(labels)
    confidence = round(random.uniform(0.6, 0.99), 2)
    # Optionally estimate weight via heuristics or another model
    return { 'label': label, 'confidence': confidence }


def run_local_tflite(image_path):
    try:
        # Basic outline: user must adapt to their model input/output format
        from PIL import Image
        import numpy as np
        try:
            from tflite_runtime.interpreter import Interpreter
        except Exception:
            from tensorflow.lite.python.interpreter import Interpreter
        if not TFLITE_MODEL_PATH or not Path(TFLITE_MODEL_PATH).exists():
            print('TFLITE_MODEL_PATH not set or file missing')
            return None
        interp = Interpreter(model_path=str(TFLITE_MODEL_PATH))
        interp.allocate_tensors()
        inp = interp.get_input_details()[0]
        out = interp.get_output_details()[0]
        # naive preprocessing: resize to expected size and normalize
        w = inp['shape'][2]
        h = inp['shape'][1]
        img = Image.open(image_path).convert('RGB').resize((w,h))
        arr = (np.asarray(img).astype('float32') / 255.0)[None, ...]
        interp.set_tensor(inp['index'], arr)
        interp.invoke()
        output_data = interp.get_tensor(out['index'])
        scores = output_data[0]
        top = int(scores.argmax())
        conf = float(scores[top])
        return { 'label': f'class_{top}', 'confidence': round(conf,3) }
    except Exception as e:
        print('TFLite inference failed:', e)
        return None


@sio.event
def connect():
    print('Socket connected, id=', sio.sid)
    # Register device
    try:
        sio.emit('register_device', {'name': DEVICE_NAME, 'token': DEVICE_TOKEN})
    except Exception as e:
        print('register emit failed:', e)


@sio.on('register_success')
def on_register_success(data):
    print('Register success:', data)


@sio.on('register_error')
def on_register_error(data):
    print('Register error:', data)


@sio.on('run_model')
def on_run_model(payload):
    print('Received run_model:', payload)
    requestId = payload.get('requestId') if isinstance(payload, dict) else None
    params = payload.get('params') if isinstance(payload, dict) else {}

    # Capture image
    img = None
    if USE_RASPISTILL:
        img = capture_with_raspistill()
    if not img:
        img = capture_with_opencv()
    if not img:
        print('Capture failed')
        sio.emit('iot-model-result', {'requestId': requestId, 'device': DEVICE_NAME, 'error': 'capture_failed'})
        return

    # Upload frame so website can show it
    b64 = b64_from_bytes(img)
    uploaded = upload_frame_to_server(DEVICE_NAME, b64)

    # Emit iot-photo for immediate viewing
    try:
        sio.emit('iot-photo', { 'requestId': requestId, 'device': DEVICE_NAME, 'image_b64': b64 })
        print('Emitted iot-photo')
    except Exception as e:
        print('emit iot-photo failed', e)

    # Run model locally (TFLite if present, otherwise stub)
    result = None
    # Save the capture to disk for tflite if needed
    try:
        with open(CAPTURE_PATH, 'wb') as f:
            f.write(img)
    except Exception:
        pass
    # Prefer TorchScript model if available
    result = None
    try:
        if TORCH_MODEL_PATH and Path(TORCH_MODEL_PATH).exists():
            result = run_local_torchscript(CAPTURE_PATH)
    except Exception as e:
        print('Error attempting TorchScript inference:', e)
        result = None

    # Fallback to TFLite if TorchScript not available or failed
    if not result and TFLITE_MODEL_PATH and Path(TFLITE_MODEL_PATH).exists():
        result = run_local_tflite(CAPTURE_PATH)

    # Final fallback to stub
    if not result:
        result = run_local_model_stub(img)

    # Attach optional metadata
    result_payload = { 'label': result.get('label'), 'confidence': result.get('confidence'), 'source': 'device' }
    # Emit via socket
    try:
        sio.emit('iot-model-result', { 'requestId': requestId, 'device': DEVICE_NAME, 'result': result_payload })
        print('Emitted iot-model-result')
    except Exception as e:
        print('emit iot-model-result failed', e)

    # Also POST to server for persistence
    post_model_result(DEVICE_NAME, result_payload)


@sio.event
def disconnect():
    print('Socket disconnected')


def main():
    print('Starting Pi client. SERVER_URL=', SERVER_URL, 'DEVICE_NAME=', DEVICE_NAME)
    try:
        sio.connect(SERVER_URL, transports=['websocket'])
    except Exception as e:
        print('Socket connect failed:', e)
        print('Retrying in 5s...')
        time.sleep(5)
        try:
            sio.connect(SERVER_URL, transports=['websocket'])
        except Exception as e:
            print('Second connect failed:', e)
            sys.exit(1)
    try:
        sio.wait()
    except KeyboardInterrupt:
        print('Interrupted, shutting down')


if __name__ == '__main__':
    main()
