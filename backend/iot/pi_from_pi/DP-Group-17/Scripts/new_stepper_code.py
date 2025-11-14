import time
from gpiozero import Device, OutputDevice
from gpiozero.pins.pigpio import PiGPIOFactory

# --- 1. INITIALIZE GLOBAL FACTORY (for precise timing) ---
Device.pin_factory = PiGPIOFactory()

# --- 2. DEFINE YOUR PINS (BCM numbering) ---
PUL_PIN = 21  # STEP
DIR_PIN = 20  # DIRECTION
ENA_PIN = 16  # ENABLE

# --- 3. DEFINE YOUR MOTOR & DRIVER SETTINGS ---
ACW = 1
CW = 0
PULSE_WIDTH_SEC = 0.003  # same as working tester
DIR_INVERTED = True       # flip to False if opposite

# --- 4. DEFINE CATEGORY STEPS ---
STEPS_CAT_2_4 = 300
STEPS_CAT_3_5 = 600

# --- 5. SETUP GPIO DEVICES ---
ENA = OutputDevice(ENA_PIN)   # We’ll handle logic manually
DIR = OutputDevice(DIR_PIN)
PUL = OutputDevice(PUL_PIN)

# Enable driver once at startup (LOW = enable)
ENA.off()


def step_motor(steps, direction):
    """
    Spins the motor a specific number of steps in a given direction.
    """
    dir_signal = int(direction) ^ int(DIR_INVERTED)
    DIR.value = dir_signal

    print(f"    Moving {steps} steps, direction: {'ACW' if direction == ACW else 'CW'}")

    for _ in range(steps):
        PUL.on()
        time.sleep(PULSE_WIDTH_SEC)
        PUL.off()
        time.sleep(PULSE_WIDTH_SEC)

    print("    Move complete.")


def move_to_category(category):
    """
    Moves the motor to the specified category position.
    """
    print(f"Moving to Category {category}...")

    if category == 1:
        print("Already at Cat 1 (Initial).")
    elif category == 2:
        step_motor(STEPS_CAT_2_4, ACW)
    elif category == 3:
        step_motor(STEPS_CAT_3_5, ACW)
    elif category == 4:
        step_motor(STEPS_CAT_2_4, CW)
    elif category == 5:
        step_motor(STEPS_CAT_3_5, CW)
    else:
        print("Error: Unknown category.")


def return_to_initial(category):
    """
    Returns the motor to the initial position.
    """
    print(f"Returning from Category {category}...")

    if category == 1:
        print("Already at Cat 1 (Initial).")
    elif category == 2:
        step_motor(STEPS_CAT_2_4, CW)
    elif category == 3:
        step_motor(STEPS_CAT_3_5, CW)
    elif category == 4:
        step_motor(STEPS_CAT_2_4, ACW)
    elif category == 5:
        step_motor(STEPS_CAT_3_5, ACW)
    else:
        print("Error: Unknown category.")


def cleanup():
    """
    Safely disables the driver and closes pins.
    """
    print("Cleaning up stepper pins.")
    ENA.on()  # Disable driver (HIGH = disable)
    if 'ENA' in globals():
        ENA.close()
    if 'PUL' in globals():
        PUL.close()
    if 'DIR' in globals():
        DIR.close()


# --- TEST BLOCK ---
if __name__ == "__main__":
    try:
        print("--- Testing stepper_motor.py ---")
        print("Press Ctrl+C to stop.\n")

        move_to_category(3)
        time.sleep(1)
        return_to_initial(3)
        time.sleep(1)
        move_to_category(4)
        time.sleep(1)
        return_to_initial(4)

    except KeyboardInterrupt:
        print("\nTest stopped by user.")
    finally:
        cleanup()
