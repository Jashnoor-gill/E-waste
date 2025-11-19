import cv2
import time
import datetime
from pathlib import Path

def capture():
    photos_dir = Path(__file__).resolve().parent.parent / "Photos"
    photos_dir.mkdir(exist_ok=True)
    base_path = photos_dir / "captured_image"

    cam = cv2.VideoCapture(0)

    # --- UPDATED FOR YOUR SPECS ---
    # Set resolution to your camera's native HD 720p
    cam.set(3, 1280) # 3 is CAP_PROP_FRAME_WIDTH
    cam.set(4, 720)  # 4 is CAP_PROP_FRAME_HEIGHT
    
    # Check what resolution was
    width = cam.get(3)
    height = cam.get(4)
    print(f"Attempted 1280x720, camera is set to: {width}x{height}")

    # --- KEEP THIS ---
    # Give the camera 3 seconds to adjust its Auto White Balance and auto-exposure
    time.sleep(3) 

    # Read and discard a few frames to clear the buffer
    img = None
    for _ in range(5):
        ret, img = cam.read()
        if not ret:
            print("Failed to capture image")
            cam.release()
            return None

    # --- RECOMMENDATION ---
    # Save as .png for perfect, lossless quality.
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{base_path}_{timestamp}.png" 
    
    cv2.imwrite(str(filename), img)
    print(f"Image saved as {filename}")

    cam.release()
    # cv2.destroyAllWindows()
    return filename

# --- Other spec notes ---
# - Driverless: This is why cv2.VideoCapture(0) works easily.
# - LED Lights: This is a hardware feature. For best quality, 
#   make sure they are on if you are in a dimly lit room.
# - Digital Zoom: Avoid using this. Digital zoom just crops 
#   and enlarges the 720p image, which severely *reduces* quality.
#   Always capture at the native 1x zoom.