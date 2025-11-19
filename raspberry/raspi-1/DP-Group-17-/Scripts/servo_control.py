import gpiozero
import time

# --- 1. CONFIGURATION ---
SERVO_PIN_1 = 17  # GPIO 17
SERVO_PIN_2 = 18  # GPIO 18

# How long (in seconds) the servos stay in the 'open' position
OPEN_TIME_SEC = 3.0

# Pulse widths for calibration.
# These values (0.5ms to 2.5ms) work for most servos (e.g., MG996R, SG90)
# 0.0005 = 0 degrees, 0.0025 = 180 degrees
MIN_PULSE = 0.5/1000
MAX_PULSE = 2.5/1000

# --- 2. GLOBAL DEVICES ---
servo_1 = None
servo_2 = None

# --- 3. SETUP GPIO DEVICES (Runs on import) ---
# These will AUTOMATICALLY use the factory set by main.py

servo_1 = gpiozero.Servo(
    SERVO_PIN_1,
    min_pulse_width=MIN_PULSE,
    max_pulse_width=MAX_PULSE
)
servo_2 = gpiozero.Servo(
    SERVO_PIN_2,
    min_pulse_width=MIN_PULSE,
    max_pulse_width=MAX_PULSE
)

# Start in the "closed" (max) position
print("Moving servos to initial 'Closed' (max) position.")
servo_1.value = 0.9    # servo 1 at max position
servo_2.value = 0   # servo 2 at max position
time.sleep(1)
servo_1.value = None  # Detach to stop jitter
servo_2.value = None  # Detach to stop jitter


# --- 4. PUBLIC FUNCTION ---
def run_servo():
    """
    Runs one full "open and close" cycle on both servos.
    Takes no input.
    Open = min() equivalent
    Close = max() equivalent
    """

    # Moving to open position
    print("Opening servos...")
    servo_1.value = 0.1   # servo1 min
    time.sleep(0.1)
    servo_2.value = 0.9    # servo2 min
    print("Servos opened.")
     # Give them time to move
    time.sleep(OPEN_TIME_SEC)


    # Moving to closed position
    print("Closing servos...")
    servo_1.value = 0.9    # servo1 max
    time.sleep(0.1)
    servo_2.value = 0   # servo2 max
    print("Servos closed.")

    time.sleep(1)  # Give them time to move

    # Detaching to stop jitter
    servo_1.value = None
    servo_2.value = None


# --- 5. CLEANUP FUNCTION ---
def cleanup():
    """
    Safely closes servo devices.
    (Leaves the factory alone, as main.py handles it)
    """
    
    if servo_1:
        servo_1.close()
    if servo_2:
        servo_2.close()


# --- 6. TEST BLOCK ---
# This code only runs if you execute this file directly:
# python3 servo_control.py
if __name__ == "__main__":
    from gpiozero import Device
    from gpiozero.pins.pigpio import PiGPIOFactory
    
    print("--- Testing servo_control.py directly ---")
    
    # For testing, we must create our own factory
    try:
        Device.pin_factory = PiGPIOFactory()
        print("Test factory created.")
        
        # The import-level code should have already run,
        # so servos should be set up and in the 'closed' position.
        
        print("\nRunning test cycle 1...")
        run_servo()
        
        print("\nWaiting 2 seconds...")
        time.sleep(2)
        
        print("\nRunning test cycle 2...")
        run_servo()
        print("\nTest cycles complete.")

    except Exception as e:
        print(f"Test failed: {e}")
    finally:
        cleanup() # Clean up our devices
        if Device.pin_factory:
            Device.pin_factory.close()
            print("Test factory closed.")
        print("--- Test complete ---")
