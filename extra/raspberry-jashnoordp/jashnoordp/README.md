Raspberry Pi deployment for E-Waste project (folder: `jashnoordp`)

This folder contains a simple Pi client that integrates with the backend in this repository. The Pi client:

- Connects to the backend's Socket.IO server and registers under a device name
- Listens for `run_model` events and captures a photo
- Uploads the captured photo to `/api/frame/upload_frame` so the website can show it
- Runs local inference (TFLite if configured, otherwise a stub) and sends the result back via `/api/iot/model_result` and `iot-model-result` socket event

Files
- `pi_client.py` — main Python client (run on Pi)
- `requirements.txt` — packages to install via pip
- `jashnoordp.service` — example systemd service file (see below)

Quick start (on Raspberry Pi)
1. Copy this folder to the Pi, e.g. `/home/pi/jashnoordp`
2. Create a Python venv (recommended):

   python3 -m venv venv
   source venv/bin/activate

3. Install deps (adjust for Pi architecture — you may prefer platform-specific tflite runtime):

   pip install -r requirements.txt

   # If you want OpenCV support (optional):
   pip install opencv-python-headless

   # For TFLite inference, install tflite-runtime wheel for your Pi's Python version/architecture.

4. Configure environment variables (recommended to create a small env file):

   export EW_BACKEND_URL="http://<BACKEND_HOST>:5000"
   export DEVICE_NAME="raspi-1"
   export DEVICE_TOKEN="<device-token-if-configured>"
   export TFLITE_MODEL_PATH="/home/pi/model/my_model.tflite"  # optional

5. Run the client (in venv):

   python3 pi_client.py

6. (Optional) Install as systemd service
- Copy `jashnoordp.service` to `/etc/systemd/system/jashnoordp.service` and edit the paths
- Then enable/start:

   sudo systemctl daemon-reload
   sudo systemctl enable jashnoordp.service
   sudo systemctl start jashnoordp.service
   sudo journalctl -u jashnoordp.service -f

Notes
- The client tries `raspistill` first (fast on Raspberry Pi OS with camera module). If raspistill is not available, it falls back to OpenCV capture.
- The backend expects POSTs to `/api/frame/upload_frame` and `/api/iot/model_result`. If your backend uses device tokens, provide `DEVICE_TOKEN` environment variable; the client sets `x-device-token` on those requests.
- The frontend already listens for `iot-photo` and `iot-model-result` events and will display the received image & result automatically.

Security
- Keep device tokens secret. If you place tokens in systemd service files, restrict file permissions.

If you want, I can also:
- Add the example `jashnoordp.service` file here (I can create it now)
- Create a small helper script to copy the folder to a Pi via `scp` if you provide the Pi's IP
- Add a Node.js variant of the client instead of Python

Tell me which of those you want next.