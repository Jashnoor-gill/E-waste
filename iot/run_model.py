"""
Example wrapper to run an ML model locally. Replace with your actual model invocation.
This script should output JSON to stdout describing the inference result.
"""
import json
import random
import time

# Simulate inference
time.sleep(1.2)
labels = ['phone', 'laptop', 'battery', 'accessory', 'unknown']
label = random.choice(labels)
confidence = round(random.uniform(0.6, 0.99), 2)
result = { 'label': label, 'confidence': confidence }
print(json.dumps(result))
