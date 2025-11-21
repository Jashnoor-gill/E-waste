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
import tempfile
import threading
from datetime import datetime

import requests
import subprocess

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

# --- Ultrasonic sensor integration (optional) ---
try:
    from gpiozero import DistanceSensor
except Exception:
    DistanceSensor = None

# BIN update endpoint: can be a full URL or backend base URL. If you provide
# just the backend URL, the client will append `/api/bin/update` by default.
BIN_UPDATE_URL = os.environ.get('BIN_UPDATE_URL') or os.environ.get('BACKEND_BIN_UPDATE_URL') or os.environ.get('BACKEND_URL')
if BIN_UPDATE_URL and BIN_UPDATE_URL.endswith('/'):
    BIN_UPDATE_URL = BIN_UPDATE_URL[:-1]
if BIN_UPDATE_URL and BIN_UPDATE_URL.count('/') <= 3:
    BIN_UPDATE_URL = BIN_UPDATE_URL + '/api/bin/update'

UPDATE_INTERVAL = float(os.environ.get('UPDATE_INTERVAL', '10'))

# Default bin definitions (override by setting env var BIN_CONFIG_JSON to a JSON list)
DEFAULT_BINS = [
    {"id": "bin-1", "trigger": 23, "echo": 24, "empty_distance_cm": 80.0, "full_distance_cm": 10.0},
]

def load_bins_config():
    cfg_json = os.environ.get('BIN_CONFIG_JSON')
    if cfg_json:
        try:
            parsed = json.loads(cfg_json)
            if isinstance(parsed, list):
                return parsed
        except Exception as e:
            print('Failed to parse BIN_CONFIG_JSON:', e)
    return DEFAULT_BINS


class SensorWrapper:
    def __init__(self, cfg):
        self.id = cfg.get('id')
        self.trigger = cfg.get('trigger')
        self.echo = cfg.get('echo')
        self.empty_cm = float(cfg.get('empty_distance_cm', 80.0))
        self.full_cm = float(cfg.get('full_distance_cm', 10.0))
        self._sensor = None
        if DistanceSensor is not None and self.trigger is not None and self.echo is not None:
            try:
                self._sensor = DistanceSensor(echo=self.echo, trigger=self.trigger)
            except Exception as e:
                print(f'[sensor {self.id}] DistanceSensor init failed: {e}')

    def read_distance_cm(self):
        if self._sensor is None:
            return None
        try:
            d = self._sensor.distance
            if d is None:
                return None
            return float(d) * 100.0
        except Exception as e:
            print(f'[sensor {self.id}] read error: {e}')
            return None

    def compute_fill(self, distance_cm):
        if distance_cm is None:
            return None
        if distance_cm >= self.empty_cm:
            return 0.0
        if distance_cm <= self.full_cm:
            return 100.0
        span = self.empty_cm - self.full_cm
        if span <= 0:
            return 0.0
        filled = (self.empty_cm - distance_cm) / span * 100.0
        return max(0.0, min(100.0, filled))


def sensor_monitor_thread():
    bins_cfg = load_bins_config()
    sensors = [SensorWrapper(cfg) for cfg in bins_cfg]
    print(f'[ultrasonic] starting monitor for {len(sensors)} sensors; interval={UPDATE_INTERVAL}s; POST->{BIN_UPDATE_URL}')
    stop = False

    def _handle_stop(signum=None, frame=None):
        nonlocal stop
        stop = True

    # thread-local signal handling not reliable; thread respects main process exit

    while not stop:
        for s in sensors:
            d = s.read_distance_cm()
            p = s.compute_fill(d)
            payload = {
                'bin_id': s.id,
                'distance_cm': d,
                'fill_percent': p,
                'ts': datetime.utcnow().isoformat() + 'Z',
            }
            if BIN_UPDATE_URL:
                try:
                    resp = requests.post(BIN_UPDATE_URL, json=payload, timeout=5)
                    print(f'[ultrasonic] posted {s.id} status={resp.status_code}')
                except Exception as e:
                    print(f'[ultrasonic] failed POST for {s.id}: {e}')
            else:
                print('[ultrasonic] BIN_UPDATE_URL not set; payload:', payload)
        # sleep with small increments to be responsive to shutdown
        slept = 0.0
        while slept < UPDATE_INTERVAL:
            time.sleep(0.5)
            slept += 0.5


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
    # Optionally run the full machinery on-device (capture -> classify -> actuate)
    try:
        if params.get('run_main'):
            def _run_main_async():
                try:
                    main_py = os.path.join(os.path.dirname(__file__), 'Scripts', 'main.py')
                    print('Running local main.py for full actuation:', main_py)
                    subprocess.run([sys.executable, main_py], check=True)
                    print('Local main.py completed')
                except Exception as ex:
                    print('Failed to run main.py:', ex)
            t = threading.Thread(target=_run_main_async, daemon=True)
            t.start()
    except Exception as e:
        print('Error scheduling main.py run:', e)


@sio.on('capture')
def on_capture(payload):
    """Handle 'capture' events from the server: capture an image and emit it as `iot-photo`.
    Expects payload { requestId, metadata? } and emits { requestId, image_b64, device }.
    """
    try:
        print('capture event received:', payload)
        requestId = payload.get('requestId') if isinstance(payload, dict) else None
        # Try to use the helper capture script if present
        image_path = None
        try:
            from capture_image import capture as capture_fn
            # capture() should return a filesystem path or raise on failure
            image_path = capture_fn()
            print('capture_image returned path:', image_path)
        except Exception as e:
            # Fallback: try OpenCV quick capture
            try:
                import cv2
                tmp_path = os.path.join(os.path.dirname(__file__), f'capture_{int(time.time())}.jpg')
                cap = cv2.VideoCapture(0)
                ret, frame = cap.read()
                cap.release()
                if ret:
                    cv2.imwrite(tmp_path, frame)
                    image_path = tmp_path
                    print('OpenCV captured image to', tmp_path)
                else:
                    print('OpenCV capture failed')
            except Exception as e2:
                print('Capture fallback failed:', e, e2)

        if not image_path or not os.path.exists(image_path):
            print('No image captured; emitting error response')
            try:
                sio.emit('iot-photo', {'requestId': requestId, 'error': 'capture_failed', 'device': args.name})
            except Exception:
                pass
            return

        # Read file and compress with OpenCV (preferred), then base64-encode
        try:
            b64 = None
            try:
                import cv2
                # read, resize to 320x240, encode as jpeg with quality 50
                img_cv = cv2.imread(image_path)
                if img_cv is not None:
                    resized = cv2.resize(img_cv, (320, 240))
                    ret, buf = cv2.imencode('.jpg', resized, [int(cv2.IMWRITE_JPEG_QUALITY), 50])
                    if ret:
                        b64 = base64.b64encode(buf.tobytes()).decode('ascii')
                    else:
                        raise Exception('cv2.imencode failed')
                else:
                    raise Exception('cv2.imread failed')
            except Exception:
                # OpenCV path failed — fallback to Pillow-based resize/compress
                try:
                    from PIL import Image
                    # Configurable via env vars
                    max_w = int(os.environ.get('IMAGE_MAX_WIDTH', '640'))
                    max_h = int(os.environ.get('IMAGE_MAX_HEIGHT', '480'))
                    quality = int(os.environ.get('IMAGE_JPEG_QUALITY', '75'))
                    img = Image.open(image_path).convert('RGB')
                    img.thumbnail((max_w, max_h), Image.LANCZOS)
                    tmpf = tempfile.NamedTemporaryFile(suffix='.jpg', delete=False)
                    tmpf_name = tmpf.name
                    tmpf.close()
                    img.save(tmpf_name, format='JPEG', quality=quality)
                    with open(tmpf_name, 'rb') as f:
                        b64 = base64.b64encode(f.read()).decode('ascii')
                    try:
                        os.remove(tmpf_name)
                    except Exception:
                        pass
                except Exception:
                    # Pillow not available or processing failed — send original file
                    with open(image_path, 'rb') as f:
                        b64 = base64.b64encode(f.read()).decode('ascii')

            if not b64:
                raise Exception('Failed to produce base64 image payload')

            payload_out = {'requestId': requestId, 'image_b64': b64, 'device': args.name}
            sio.emit('iot-photo', payload_out)
            print('Emitted iot-photo', {'requestId': requestId, 'len_image_b64': len(b64)})
        except Exception as e:
            print('Failed to emit iot-photo:', e)
    except Exception as e:
        print('capture handler error:', e)


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
    # Start sensor monitor in background (if gpiozero present or configured)
    try:
        t = threading.Thread(target=sensor_monitor_thread, name='ultrasonic-monitor', daemon=True)
        t.start()
    except Exception as e:
        print('Failed to start ultrasonic monitor thread:', e)
    try:
        # Allow socketio to pick the best transport (will try websocket then polling).
        # Previously we forced websocket-only. That fails if `websocket-client` is missing.
        # Let the client fallback gracefully so deployments work even if the optional
        # websocket client package is not installed.
        try:
            sio.connect(args.server)
        except Exception as e:
            print('Connection error (initial):', e)
            # As a last-resort, attempt connect with explicit transports including polling
            try:
                sio.connect(args.server, transports=['websocket', 'polling'])
            except Exception as e2:
                print('Connection error (fallback):', e2)
                time.sleep(5)
                sys.exit(1)
        sio.wait()
    except Exception as e:
        print('Connection error:', e)
        time.sleep(5)
        sys.exit(1)


if __name__ == '__main__':
    main()
