Pi client quickstart
=====================

This folder contains a small Raspberry Pi example client (`pi_client.py`) that registers with the backend and responds to `capture` and `run_model` events.

Prerequisites (on the Pi)
- Python 3
- pip

Install dependencies
--------------------
Run from this folder:

```bash
cd ~/path/to/repo/backend/iot
pip3 install -r requirements.txt
```

Run the Pi client
-----------------
Basic run (point at your backend):

```bash
BACKEND_URL='https://e-waste-backend-3qxc.onrender.com' DEVICE_NAME='raspi-1' python3 pi_client.py
```

If your backend requires a device token, include it:

```bash
BACKEND_URL='https://e-waste-backend-3qxc.onrender.com' DEVICE_NAME='raspi-1' DEVICE_TOKEN_TO_USE='the-token' python3 pi_client.py
```

What the client does
- Opens a socket.io connection to the backend
- Emits `register_device` (name + optional token)
- Listens for `capture` and emits `iot-photo` with a placeholder base64
- Listens for `run_model` and emits `iot-model-result` with a simulated label/confidence

Verify registration
-------------------
On any machine (or via your browser), call the backend debug endpoint to see registered devices:

```powershell
Invoke-RestMethod -Uri 'https://e-waste-backend-3qxc.onrender.com/debug/devices' -Method Get
```

You should see your Pi listed.

Systemd example (auto-start on boot)
-----------------------------------
Create a systemd service at `/etc/systemd/system/pi-client.service` (example):

```
[Unit]
Description=E-waste Pi client
After=network-online.target

[Service]
User=pi
WorkingDirectory=/home/pi/path/to/repo/backend/iot
ExecStart=/usr/bin/env BACKEND_URL='https://e-waste-backend-3qxc.onrender.com' DEVICE_NAME='raspi-1' /usr/bin/python3 pi_client.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable pi-client
sudo systemctl start pi-client
sudo journalctl -u pi-client -f
```

Notes
-----
- Replace `BACKEND_URL` and `DEVICE_NAME` with your values.
- If the backend enforces device tokens, set `DEVICE_TOKEN_TO_USE` env var in the service ExecStart line.
- The example client uses simulated image bytes and simulated model results; replace with real camera/inference logic as needed.
