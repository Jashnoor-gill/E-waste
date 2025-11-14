#!/usr/bin/env python3

import time
import sys
from gpiozero import Device, Servo
from gpiozero.pins.pigpio import PiGPIOFactory

# --- 1. CONFIGURATION ---
SERVO_PIN_1 = 17  # GPIO pin for first servo
SERVO_PIN_2 = 18  # GPIO pin for second servo

# Pulse widths for calibration (0.0005=0deg, 0.0025=180deg)
MIN_PULSE = 0.0005
MAX_PULSE = 0.0025

# Pause time (in seconds) to let servos reach their position
PAUSE_TIME = 2

# --- 2. GLOBAL DEVICES ---
servo_1 = None
servo_2 = None

# --- 3. MAIN SCRIPT ---
try:
    # --- Setup Factory ---
    print("Starting pigpio factory...")
    Device.pin_factory = PiGPIOFactory()
    
    # --- Setup Devices ---
    print(f"Initializing Servo 1 on GPIO {SERVO_PIN_1}")
    servo_1 = Servo(
        SERVO_PIN_1,
        min_pulse_width=MIN_PULSE,
        max_pulse_width=MAX_PULSE
    )
    
    print(f"Initializing Servo 2 on GPIO {SERVO_PIN_2}")
    servo_2 = Servo(
        SERVO_PIN_2,
        min_pulse_width=MIN_PULSE,
        max_pulse_width=MAX_PULSE
    )
    
    print("\n--- Starting Continuous Servo Test ---")
    print("Press Ctrl+C to stop.")

    # --- Continuous Loop ---
    while True:
        print("Moving to MIN position...")
        servo_1.min()
        servo_2.min()
        time.sleep(PAUSE_TIME)
        
        print("Moving to MAX position...")
        servo_1.max()
        servo_2.max()
        time.sleep(PAUSE_TIME)

except KeyboardInterrupt:
    print("\nTest stopped by user.")
except Exception as e:
    print(f"\nAn error occurred: {e}")
    print("Please ensure 'sudo pigpiod' is running.")

finally:
    # --- 4. CLEANUP ---
    print("Cleaning up GPIO...")
    if servo_1:
        servo_1.value = None # Detach
        servo_1.close()
    if servo_2:
        servo_2.value = None # Detach
        servo_2.close()
        
    if Device.pin_factory:
        Device.pin_factory.close()
        print("pigpio factory closed.")
