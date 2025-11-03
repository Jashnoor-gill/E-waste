# scripts/main.py
from pathlib import Path
from Classify_Image import classify_image
from Capture_Image import capture  # <-- added this import

def main():
    print("Capturing image...")
    image_path = capture()  # capture and get file path

    print("Running classification...")
    label = classify_image(str(image_path))

    print(f"\n✅ Final Prediction: {label}\n")

if __name__ == "__main__":
    main()
