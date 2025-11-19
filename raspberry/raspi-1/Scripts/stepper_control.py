import time
from gpiozero import OutputDevice

# --- 1. DEFINE YOUR PINS (BCM numbering) ---
PUL_PIN = 21 #GPIO21
DIR_PIN = 20 #GPIO20
ENA_PIN = 16 #GPIO16

# --- 2. DEFINE YOUR MOTOR & DRIVER SETTINGS ---
ACW = 1
CW = 0
PULSE_WIDTH_SEC = 0.0001

# --- 3. DEFINE YOUR CATEGORY STEPS ---
STEPS_CAT_2_4 = 300
STEPS_CAT_3_5 = 500

# --- 4. SETUP GPIO DEVICES ---
ENA = OutputDevice(ENA_PIN, active_high=False, initial_value=True)
DIR = OutputDevice(DIR_PIN)
PUL = OutputDevice(PUL_PIN)



def step_motor(steps, direction):
    """
    Spins the motor a specific number of steps in a given direction.
    """
    print(f"    Moving {steps} steps, direction: {'ACW' if direction == ACW else 'CW'}")
    
    ENA.on()
    DIR.value = direction
    time.sleep(0.001)

    for _ in range(steps):
        PUL.on()
        time.sleep(PULSE_WIDTH_SEC)
        PUL.off()
        time.sleep(PULSE_WIDTH_SEC)

    ENA.off()
    print("    Move complete. Driver disabled.")

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


# --- MODIFIED CLEANUP ---
def cleanup():
    """
    Safely disables the driver and closes pins.
    (Leaves the factory alone)
    """
    print("Cleaning up stepper pins.")
    if 'ENA' in globals():
        ENA.off()
        ENA.close()
    if 'PUL' in globals():
        PUL.close()
    if 'DIR' in globals():
        DIR.close()
    


# --- 7. TEST BLOCK (Only runs when you execute this file directly) ---
if __name__ == "__main__":
    try:
        print("--- Testing stepper_motor.py directly ---")
        
        move_to_category(3)
        time.sleep(1)
        return_to_initial(3)
        time.sleep(1)
        move_to_category(4)
        time.sleep(1)
        return_to_initial(4)

    except KeyboardInterrupt:
        print("Test stopped.")
    finally:
        cleanup()  # Clean up when test is done