# Raspberry Pi (raspi-1)

This folder contains the canonical Raspberry Pi code for device aspi-1.

Structure:
- Model/ - put your TorchScript model file here on the Pi (not committed to repo unless using LFS).
- Scripts/ - capture, classify, servo control scripts (device-side logic).
- Testing/ - test utilities.

Quick start (on the Pi):
1. Copy the model into ~/raspi-1/Model/new_layer4_resnet50_ewaste_traced.pt or similar.
2. Install Python dependencies (adjust versions if needed):
   `ash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   `
3. Configure the Pi client (pi_client.py) with your server URL and device token:
   - Edit or pass --server https://e-waste-backend-3qxc.onrender.com and --token <DEVICE_TOKEN>
   - Device name should be aspi-1 (or change accordingly and register the same name in the web UI).
4. Start the service manually for testing:
   `ash
   python3 pi_client.py --server https://e-waste-backend-3qxc.onrender.com --name raspi-1 --token <DEVICE_TOKEN>
   `
5. Test flow from website: on the frontend click Capture image -> backend will forward to connected device and you should see servo actions and classification results.

Security & notes:
- Use DEVICE_TOKENS environment variable on your backend to restrict device registrations.
- Keep model binaries off the main branch or use Git LFS or external hosting.
- Logs: backend logs show forwarding; model service logs show model downloads and loads.

