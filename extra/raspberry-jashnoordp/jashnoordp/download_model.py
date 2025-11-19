#!/usr/bin/env python3
"""
Helper to download a TFLite model from a URL into the Pi client folder.
Usage: python3 download_model.py --url https://.../model.tflite --out model.tflite
"""
import argparse
import requests
import sys
import os

p = argparse.ArgumentParser()
p.add_argument('--url', '-u', required=True)
p.add_argument('--out', '-o', default='model.tflite')
args = p.parse_args()
try:
    r = requests.get(args.url, stream=True, timeout=30)
    r.raise_for_status()
    with open(args.out, 'wb') as f:
        for chunk in r.iter_content(8192):
            if chunk:
                f.write(chunk)
    print('Downloaded', args.out)
except Exception as e:
    print('Download failed', e)
    sys.exit(2)
