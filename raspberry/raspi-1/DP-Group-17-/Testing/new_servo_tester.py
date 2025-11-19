from gpiozero import Servo, Device
from gpiozero.pins.pigpio import PiGPIOFactory
from time import sleep

# Use PiGPIOFactory for accurate PWM control
Device.pin_factory = PiGPIOFactory()

# Connect servo to GPIO 18
servo = Servo(17, min_pulse_width=0.5/1000, max_pulse_width=2.5/1000)

print("Servo test started! Moving to custom positions slightly beyond normal range...")

while True:
    try:
        # Slightly less than minimum position
        servo.value = -0.25
        print("Position: -1.1 (Slightly below min)")
        sleep(1)

        # Slightly more than maximum position
        servo.value = +0.6
        print("Position: +1.1 (Slightly above max)")
        sleep(1)

    except KeyboardInterrupt:
        print("\nExiting and releasing servo...")
        servo.detach()
        break
