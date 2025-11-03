"""
Simple capture script that takes a photo and returns the saved file path.
This example uses raspistill (Raspberry Pi) if available, otherwise falls back to OpenCV.
"""
import os
import time
from datetime import datetime

OUT_DIR = 'iot_captures'
os.makedirs(OUT_DIR, exist_ok=True)
fn = os.path.join(OUT_DIR, f'capture_{int(time.time())}.jpg')

# Try raspistill
try:
    ret = os.system(f'raspistill -o {fn} -t 1000')
    if ret == 0:
        print(fn)
        exit(0)
except Exception:
    pass

# Fallback to OpenCV
try:
    import cv2
    cap = cv2.VideoCapture(0)
    time.sleep(0.5)
    ret, frame = cap.read()
    if ret:
        cv2.imwrite(fn, frame)
        print(fn)
    else:
        print('')
    cap.release()
except Exception as e:
    print('')
    # print error to stderr
    # print(e)

