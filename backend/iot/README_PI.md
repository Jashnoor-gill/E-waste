Raspberry Pi Camera (CSI) integration
=====================================

This folder contains helpers and examples to run a Raspberry Pi camera client
that connects to the backend socket.io server and responds to `capture` /
`run_model` commands. It targets Raspberry Pi OS (Bullseye/Bookworm) using
libcamera. Picamera2 is supported (recommended) and there's a fallback to
`libcamera-still` if Picamera2 isn't installed.

Quick setup
-----------

1. Update Raspberry Pi OS and install tools:

```powershell
sudo apt update; sudo apt upgrade -y
sudo apt install -y python3-venv python3-pip libcamera-apps
# Optional (recommended on modern Raspberry Pi OS):
sudo apt install -y python3-picamera2
```

2. Enable the camera (if using Raspberry Pi configuration):

```powershell
sudo raspi-config
# Interface Options -> Camera -> Enable
# Reboot if prompted
```

3. Create a project folder on the Pi and copy these scripts (or clone the repo):

```powershell
mkdir -p ~/ew-pi-client; cd ~/ew-pi-client
# copy the following files into this directory:
# - pi_client.py  (existing in repo)
# - capture_pi.py
# - run_model_pi.py
```

4. Create a virtualenv and install Python deps:

```powershell
python3 -m venv .venv; . .venv/bin/activate
pip install --upgrade pip
pip install python-socketio[client] requests
# If using Picamera2: pip install picamera2 (or use apt package python3-picamera2)
```

5. Test capture locally:

```powershell
python3 capture_pi.py --outfile /tmp/test_pi.jpg
ls -l /tmp/test_pi.jpg
```

6. Test run-model POST to backend (replace BACKEND_URL):

```bash
export BACKEND_URL=https://e-waste-backend-3qxc.onrender.com/
python3 run_model_pi.py --file /tmp/test_pi.jpg --server $BACKEND_URL
```

Running as a service
--------------------

1. Copy `ew-pi-client.service.example` to `/etc/systemd/system/ew-pi-client.service` and
   edit `WorkingDirectory` and `ExecStart` to the paths where you placed the scripts.

2. Reload and enable the service:

```powershell
sudo systemctl daemon-reload
sudo systemctl enable ew-pi-client.service
sudo systemctl start ew-pi-client.service
sudo journalctl -u ew-pi-client.service -f
```

Socket.io behavior notes
------------------------

- The provided `pi_client.py` in the repo registers with the backend via socket.io
  using the name you provide. The backend emits `capture` and `run_model` events
  to the registered device. The client should emit back `iot-photo` (with base64 image)
  and `iot-model-result` (with inference results).
- `capture_pi.py` prints the saved file path to stdout so `pi_client.py` can call it
  as a subprocess and then read the file to emit the result.

Troubleshooting
---------------

- If `capture_pi.py` fails with `ModuleNotFoundError: picamera2`, either install
  Picamera2 or rely on `libcamera-still` which is installed with `libcamera-apps`.
- If images are black or distorted, ensure camera is enabled (`raspi-config`) and
  that you are using the correct OS image (Bullseye/Bookworm recommended).
- For permission issues, ensure the `pi` user (or service user) has access to the
  camera devices; running the scripts as root is a quick way to test but not required.

If you'd like, I can:
- add the `capture_pi.py` and `run_model_pi.py` into the Pi client folder used by
  `pi_client.py` (I already added these files to `backend/iot/`),
- create a simple `systemd` service file already included above,
- or modify `pi_client.py` to call `capture_pi.py`/`run_model_pi.py` directly.
