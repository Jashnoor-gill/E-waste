# Raspberry Pi client setup (E-Waste)

This file explains how to install and run the Pi socket client so the website can trigger captures and receive results.

Prerequisites
- Raspberry Pi with SSH access
- Python 3.7+ installed
- Network access to the backend URL (public or on same LAN)

Quick overview
1. Copy the Pi scripts from the repository to the Pi (recommended location: `/home/pi/ew-pi-client`).
2. Create a Python virtualenv and install dependencies.
3. Enable the systemd service `ew-pi-client.service` to start the client on boot.
4. Verify the device appears in the backend at `/api/iot/devices`.

Copy files to the Pi (from your workstation)
Replace `<PI_IP>` with your Pi's IP or hostname.

PowerShell example (run from your workstation):
```powershell
scp backend/iot/pi_copied/DP-Group-17/Scripts/*.py pi@<PI_IP>:/home/pi/ew-pi-client/
scp backend/iot/ew-pi-client.service pi@<PI_IP>:/home/pi/
```

SSH into the Pi and run the installer script (below) or follow manual steps
```bash
ssh pi@<PI_IP>
cd /home/pi
sudo mkdir -p /home/pi/ew-pi-client
sudo chown pi:pi /home/pi/ew-pi-client
cd /home/pi/ew-pi-client
# if you used scp above, files should already be in place
bash /home/pi/install_pi_client.sh
```

Manual install steps (what the installer does)
```bash
# update packages
sudo apt update && sudo apt install -y python3 python3-venv python3-pip git

# create venv
python3 -m venv /home/pi/ew-venv
source /home/pi/ew-venv/bin/activate
pip install --upgrade pip
pip install "python-socketio[client]" requests
# optional: if using OpenCV streamer
pip install opencv-python
```

Install and enable the systemd service
```bash
# move the unit file to systemd
sudo mv /home/pi/ew-pi-client/ew-pi-client.service /etc/systemd/system/ew-pi-client.service
sudo systemctl daemon-reload
# edit /etc/systemd/system/ew-pi-client.service to set BACKEND_URL and DEVICE_NAME if needed
sudo systemctl enable ew-pi-client.service
sudo systemctl start ew-pi-client.service
sudo journalctl -u ew-pi-client.service -f
```

Test flow
- Check backend device list: `curl http://<BACKEND_HOST>:5000/api/iot/devices` (should show your device name)
- From the website, open Bin User and click `Request Device Capture` — the Pi should receive a `capture` event, run capture, and send `iot-photo` back to the browser.

Troubleshooting
- If the Pi does not appear in `/api/iot/devices`, check the service logs via `journalctl -u ew-pi-client.service -f`.
- If capture fails, run `python3 pi_client.py --name pi_home --server https://YOUR_BACKEND_URL` manually to see stdout errors.
