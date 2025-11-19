#!/usr/bin/env python3
"""
Run model on a provided image file. If a TFLite model is present (TFLITE_MODEL_PATH env or --model), it will attempt to run it.
Otherwise returns a stub JSON result so the Pi can operate without a real model during testing.

Usage:
  python3 run_model.py --file /tmp/capture.jpg

Output: JSON printed to stdout: { "label": "phone", "confidence": 0.92 }
"""
import argparse
import os
import json
import sys

TFLITE_PATH = os.environ.get('TFLITE_MODEL_PATH', '')


def stub_result():
    import random
    labels = ['phone', 'laptop', 'battery', 'accessory', 'unknown']
    return { 'label': random.choice(labels), 'confidence': round(random.uniform(0.6, 0.99), 3) }


def run_tflite(model_path, image_path):
    try:
        from PIL import Image
        import numpy as np
        try:
            # try tflite-runtime first
            from tflite_runtime.interpreter import Interpreter
        except Exception:
            from tensorflow.lite.python.interpreter import Interpreter
        interp = Interpreter(model_path=model_path)
        interp.allocate_tensors()
        inp = interp.get_input_details()[0]
        out = interp.get_output_details()[0]
        # simplistic: resize to expected shape
        w = int(inp['shape'][2])
        h = int(inp['shape'][1])
        img = Image.open(image_path).convert('RGB').resize((w,h))
        arr = (np.asarray(img).astype('float32') / 255.0)[None, ...]
        interp.set_tensor(inp['index'], arr)
        interp.invoke()
        output_data = interp.get_tensor(out['index'])[0]
        top = int(output_data.argmax())
        conf = float(output_data[top])
        return { 'label': f'class_{top}', 'confidence': round(conf, 3) }
    except Exception as e:
        print('TFLite inference failed:', e, file=sys.stderr)
        return None


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--file', '-f', required=True)
    p.add_argument('--model', '-m', default='')
    args = p.parse_args()
    model = args.model or TFLITE_PATH
    image = args.file
    if model and os.path.exists(model):
        res = run_tflite(model, image)
        if res:
            print(json.dumps(res))
            return
    # fallback stub
    res = stub_result()
    print(json.dumps(res))

if __name__ == '__main__':
    main()
