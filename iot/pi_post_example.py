"""Simple Raspberry Pi example: capture a photo using the provided Capture_Image.capture()
then base64-encode it and POST to the backend /api/iot/run-model endpoint.

Usage:
    - Place this script in your project on the Pi. If you packaged capture scripts, place them in `Model/Scripts` or adapt the path.
  - Install 'requests' on the Pi: pip3 install requests
  - Run: python3 iot/pi_post_example.py --backend https://your-backend.example.com --reply-socket-id <socketId>
"""
import argparse
import base64
import requests
import sys
from pathlib import Path


def capture_image():
    # Try to import capture from the project's Model scripts. Adjust path if you placed the folder elsewhere.
    try:
        # When running from project root, the package path may resolve as below
        sys.path.append(str(Path(__file__).resolve().parent.parent))
        # prefer Model package layout
        try:
            from Model.Scripts.Capture_Image import capture
        except Exception:
            from Final_DP.Final_DP.Scripts.Capture_Image import capture
        img_path = capture()
        return img_path
    except Exception as e:
        print('Import capture failed or capture() raised:', e)
        # As fallback try directly running the script (works if script is executable)
        script = Path(__file__).resolve().parent.parent / 'Final_DP' / 'Final_DP' / 'Scripts' / 'Capture_Image.py'
        if script.exists():
            # Attempt to run as a subprocess and hope it writes the file
            import subprocess
            subprocess.run([sys.executable, str(script)])
            # The Capture_Image script writes to Photos/ with captured_image_*.png
            photos_dir = script.parent.parent / 'Photos'
            # pick newest file
            files = sorted(photos_dir.glob('captured_image_*.png'), key=lambda p: p.stat().st_mtime, reverse=True)
            if files:
                return str(files[0])
        raise RuntimeError('Failed to capture image')


def post_image(backend_url, image_path, reply_socket_id=None):
    with open(image_path, 'rb') as f:
        data = f.read()
    b64 = base64.b64encode(data).decode('ascii')
    payload = {'image_b64': b64}
    if reply_socket_id:
        payload['replySocketId'] = reply_socket_id
    url = backend_url.rstrip('/') + '/api/iot/run-model'
    print('Posting to', url, 'size bytes', len(data))
    resp = requests.post(url, json=payload, timeout=60)
    resp.raise_for_status()
    return resp.json()


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--backend', required=True, help='Backend base URL (https://...)')
    p.add_argument('--reply-socket-id', required=False, help='Optional browser socket id to forward results')
    args = p.parse_args()

    img = capture_image()
    print('Captured:', img)
    res = post_image(args.backend, img, args.reply_socket_id)
    print('Server response:', res)


if __name__ == '__main__':
    main()
