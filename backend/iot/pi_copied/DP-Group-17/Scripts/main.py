#!/usr/bin/env python3
from pathlib import Path
from gpiozero import Device
from gpiozero.pins.pigpio import PiGPIOFactory
import time

from classify_image import classify_image
from capture_image import capture  # <-- added this import
from send_frame import send as send_frame_to_backend


'''Add catagory to stepper '''


# This sets the *default* factory for all gpiozero devices
Device.pin_factory = PiGPIOFactory()


import new_stepper_code #importing whole module to ensure gpio initialization
import servo_control  #importing whole module to ensure gpio initialization


CATEGORY_MAP = {
    "Smartwatch": 1, "Mobile": 1,
    "Headphones": 2, "Mouse": 1, "Remote Control": 2,
    "Keyboard": 5, "Printer": 5,
    "Battery": 3, "PCBs": 4,
}


def main():
    a_time=time.time()
    print("Capturing image...")
    image_path = capture()  # capture and get file path

    # Send captured image to backend so the website can display it
    try:
        print('Sending captured image to backend...')
        resp = send_frame_to_backend(str(image_path))
        print('Backend response:', resp)
    except Exception as e:
        print('Failed to send frame to backend:', e)

    print("Running classification...")
    label = classify_image(str(image_path))

    print(f"\n✅ Final Prediction: {label}\n")

    
    category_number = CATEGORY_MAP.get(label)
    print(f"Waste falls in Category: {category_number}")

    # Motor Control 
    new_stepper_code.move_to_category(category_number)
    time.sleep(3)  # Wait a moment at the category position
    servo_control.run_servo()
    time.sleep(3)  # Wait a moment before returning
    new_stepper_code.return_to_initial(category_number)
    time.sleep(1)



    # Finally, close the factory
    Device.pin_factory.close()
    print("Shared pigpio factory closed.")
    b_time=time.time()
    print(f"Total runtime:{b_time-a_time}")
if __name__ == "__main__":
    main()
