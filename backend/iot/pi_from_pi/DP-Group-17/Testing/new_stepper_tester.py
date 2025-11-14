from gpiozero import Device, OutputDevice
from gpiozero.pins.pigpio import PiGPIOFactory
from time import sleep

# Initialize PiGPIOFactory globally
Device.pin_factory = PiGPIOFactory()

# Pin assignments
PUL = OutputDevice(21)  # Step
DIR = OutputDevice(20)  # Direction
ENA = OutputDevice(16)  # Enable

# Stepper config
STEPS_PER_REV = 200 * 8  # 1.8° step * 8 microstep = 1600
STEP_DELAY = 0.0003       # Adjust for speed
DIR_INVERTED = True      # <<< CHANGE TO False if direction is reversed

# Enable driver (LOW = enable)
ENA.off()

def rotate(steps, direction=True, delay=STEP_DELAY):
    """
    Rotate the motor a given number of steps.
    direction=True -> CW
    direction=False -> CCW
    """
    # Apply direction inversion if needed
    dir_signal = int(direction) ^ int(DIR_INVERTED)
    DIR.value = dir_signal

    for _ in range(steps):
        PUL.on()
        sleep(delay)
        PUL.off()
        sleep(delay)

try:
    print("Stepper Motor Test — NEMA 17 + YS-DIV268-5A (Microstep 1/8)")
    print("Press Ctrl+C to stop.\n")

    while True:
        print("Rotating CW 1 revolution...")
        rotate(STEPS_PER_REV, direction=True)
        sleep(1)

        print("Rotating CCW 1 revolution...")
        rotate(STEPS_PER_REV, direction=False)
        sleep(1)

except KeyboardInterrupt:
    print("\nTest stopped by user.")
    ENA.on()
