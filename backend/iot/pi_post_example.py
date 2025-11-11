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


def prepare_image(image_path, max_width=800, quality=70):
    """Open image, optionally resize to max_width (keeping aspect),
    and re-encode as JPEG with given quality. Returns bytes.

    Falls back to returning the raw file bytes if Pillow is not available
    or the image can't be processed.
    """
    try:
        from PIL import Image
        import io
    except Exception:
        # Pillow not available; return raw bytes
        with open(image_path, 'rb') as f:
            return f.read()

    try:
        img = Image.open(image_path)
        # convert to RGB for JPEG
        if img.mode != 'RGB':
            img = img.convert('RGB')

        # resize if wider than max_width
        if max_width and img.width > max_width:
            new_h = round((max_width / img.width) * img.height)
            img = img.resize((max_width, new_h), Image.LANCZOS)

        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=quality, optimize=True)
        return buf.getvalue()
    except Exception as e:
        print('Image processing failed, sending raw file. Error:', e)
        with open(image_path, 'rb') as f:
            return f.read()


def post_image(backend_url, image_path, reply_socket_id=None):
    # Try to resize/compress image to reduce payload size (helps avoid 413)
    data = prepare_image(image_path)
    b64 = base64.b64encode(data).decode('ascii')
    payload = {'image_b64': b64}
    if reply_socket_id:
        payload['replySocketId'] = reply_socket_id
    url = backend_url.rstrip('/') + '/api/iot/run-model'
    print('Posting to', url, 'payload bytes', len(data))
    try:
        resp = requests.post(url, json=payload, timeout=60)
    except requests.exceptions.RequestException as e:
        print('HTTP request failed:', e)
        raise
    resp.raise_for_status()
    return resp.json()


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--backend', required=True, help='Backend base URL (https://...)')
    p.add_argument('--reply-socket-id', required=False, help='Optional browser socket id to forward results')
    p.add_argument('--max-width', type=int, default=800, help='Max width to resize captured image (px). 0 to disable')
    p.add_argument('--quality', type=int, default=70, help='JPEG quality for re-encoding (1-95)')
    args = p.parse_args()

    img = capture_image()
    print('Captured:', img)
    # If the CLI provided max-width/quality, patch prepare_image behaviour by passing via globals
    # (kept simple to avoid refactoring signatures). Alternatively the helper could accept params.
    # We'll call prepare_image here to ensure the requested resizing is used.
    try:
        data = prepare_image(img, max_width=args.max_width, quality=args.quality)
        # temporary write to a bytes object for post_image path
        b64 = base64.b64encode(data).decode('ascii')
        payload = {'image_b64': b64}
        if args.reply_socket_id:
            payload['replySocketId'] = args.reply_socket_id
        url = args.backend.rstrip('/') + '/api/iot/run-model'
        print('Posting to', url, 'payload bytes', len(data))
        resp = requests.post(url, json=payload, timeout=60)
        resp.raise_for_status()
        res = resp.json()
    except Exception:
        # Fallback to the original post behaviour (will re-read file)
        res = post_image(args.backend, img, args.reply_socket_id)
    print('Server response:', res)


if __name__ == '__main__':
    main()
