#!/usr/bin/env python3

import time
from gpiozero import Device, OutputDevice
from gpiozero.pins.pigpio import PiGPIOFactory

# --- 1. DEFINE PINS (BCM numbering) ---
PUL_PIN = 21  # Pulse
DIR_PIN = 20  # Direction
ENA_PIN = 16  # Enable

# --- 2. USER CONFIGURATION (EDIT THESE!) ---

# Steps per revolution for YOUR motor (e.g., 1.8 deg = 200 steps)
MOTOR_STEPS_PER_REV = 200

# Microstepping set on your driver (e.g., 8)
MICROSTEPS = 1

# Number of revolutions to run for this test
REVOLUTIONS_TO_RUN = 2.0

# --- 3. MOTOR & SPEED SETTINGS ---
ACW = 1  # Anti-Clockwise
CW = 0   # Clockwise

# Set the direction for this test
TEST_DIRECTION = ACW

# Controls speed: smaller number = faster. (0.0005 is a good start)
PULSE_WIDTH_SEC = 0.0001

# --- 4. GLOBAL DEVICES ---
ENA = None
DIR = None
PUL = None

# --- 5. MAIN SCRIPT ---
try:
    # --- Calculate Total Steps ---
    STEPS_PER_REV_MICRO = MOTOR_STEPS_PER_REV * MICROSTEPS
    TOTAL_STEPS = int(STEPS_PER_REV_MICRO * REVOLUTIONS_TO_RUN)

    # --- Setup Factory ---
    print("Starting pigpio factory...")
    Device.pin_factory = PiGPIOFactory()
    
    # --- Setup Devices ---
    print("Initializing stepper GPIO...")
    ENA = OutputDevice(ENA_PIN, active_high=False, initial_value=True)
    DIR = OutputDevice(DIR_PIN)
    PUL = OutputDevice(PUL_PIN)

    # --- Start Test ---
    print(f"\n--- Starting Stepper Test ---")
    print(f"  Motor Steps/Rev: {MOTOR_STEPS_PER_REV}")
    print(f"  Driver Microsteps: {MICROSTEPS}")
    print(f"  Test Revolutions: {REVOLUTIONS_TO_RUN}")
    print(f"  Calculated Steps: {TOTAL_STEPS}")
    print(f"  Direction: {'ACW' if TEST_DIRECTION == ACW else 'CW'}")
    print(f"  Speed (Pulse Width): {PULSE_WIDTH_SEC}s")
    print("\nPress Ctrl+C to stop early.")
    print("Starting in 3 seconds...")
    time.sleep(3)

    # --- Run Motor ---
    print("Enabling driver...")
    ENA.on()  # Enable driver (LOW)
    DIR.value = TEST_DIRECTION
    time.sleep(0.01)  # Small delay for direction to set

    print(f"Running for {TOTAL_STEPS} steps...")
    start_time = time.time()
    
    for i in range(TOTAL_STEPS):
        PUL.on()
        time.sleep(PULSE_WIDTH_SEC)
        PUL.off()
        time.sleep(PULSE_WIDTH_SEC)
        
        # Print progress
        if (i + 1) % STEPS_PER_REV_MICRO == 0:
            print(f"  Completed revolution {int((i + 1) / STEPS_PER_REV_MICRO)}")

    end_time = time.time()
    print("...Run complete.")
    print(f"Test took {end_time - start_time:.2f} seconds.")

except KeyboardInterrupt:
    print("\nTest stopped by user.")
except Exception as e:
    print(f"\nAn error occurred: {e}")
    print("Please ensure 'sudo pigpiod' is running.")

finally:
    # --- 6. CLEANUP ---
    print("Cleaning up GPIO...")
    if ENA:
        ENA.off() # Disable driver (HIGH)
        ENA.close()
    if DIR:
        DIR.close()
    if PUL:
        PUL.close()
        
    if Device.pin_factory:
        Device.pin_factory.close()
        print("pigpio factory closed.")
