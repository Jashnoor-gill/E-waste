import time
import datetime
from pathlib import Path
import subprocess


def _photos_dir():
    p = Path(__file__).resolve().parent.parent / "Photos"
    p.mkdir(exist_ok=True)
    return p


def _libcamera_capture(out_path: Path, width=1280, height=720):
    """Use libcamera-still to capture a photo. Returns True on success."""
    cmd = [
        'libcamera-still', '-n',
        '-o', str(out_path),
        '--width', str(width),
        '--height', str(height)
    ]
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return True
    except Exception as e:
        # libcamera may not be available on this system
        print('libcamera capture failed:', e)
        return False


def capture():
    """Capture an image. Prefer OpenCV; if unavailable or camera open fails,
    fall back to `libcamera-still` (Raspberry Pi). Returns the saved filepath or None.
    """
    photos_dir = _photos_dir()
    base_path = photos_dir / "captured_image"
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{base_path}_{timestamp}.jpg"

    # Try OpenCV first (if installed)
    try:
        import cv2
        try:
            cam = cv2.VideoCapture(0)
            cam.set(3, 1280)
            cam.set(4, 720)
            # allow camera to warm up
            time.sleep(2)
            img = None
            success = False
            for _ in range(5):
                ret, img = cam.read()
                if ret and img is not None:
                    success = True
                    break
            cam.release()
            if success:
                # write as jpeg to reduce size
                cv2.imwrite(str(filename), img)
                print(f'Image saved as {filename} (cv2)')
                return str(filename)
            else:
                print('OpenCV capture failed or returned no frames')
        except Exception as e:
            print('OpenCV capture error:', e)
    except Exception:
        # cv2 not installed
        pass

    # Fallback: try libcamera-still (works on Raspberry Pi OS with camera stack)
    outp = Path(filename)
    ok = _libcamera_capture(outp)
    if ok and outp.exists():
        print(f'Image saved as {outp} (libcamera)')
        return str(outp)

    # As last resort, return None
    print('No image captured; all methods failed')
    return None

# --- Other spec notes ---
# - Driverless: This is why cv2.VideoCapture(0) works easily.
# - LED Lights: This is a hardware feature. For best quality, 
#   make sure they are on if you are in a dimly lit room.
# - Digital Zoom: Avoid using this. Digital zoom just crops 
#   and enlarges the 720p image, which severely *reduces* quality.
#   Always capture at the native 1x zoom.