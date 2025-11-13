#!/usr/bin/env bash
# Installer helper for Raspberry Pi client (run on the Pi)
# This script assumes you've placed Pi client files into /home/pi/ew-pi-client

set -euo pipefail

ROOT_DIR="/home/pi"
CLIENT_DIR="$ROOT_DIR/ew-pi-client"
VENV_DIR="$ROOT_DIR/ew-venv"

echo "Installing E-Waste Pi client into $CLIENT_DIR"
mkdir -p "$CLIENT_DIR"
chown pi:pi "$CLIENT_DIR" || true

echo "Creating virtualenv at $VENV_DIR"
python3 -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"
pip install --upgrade pip
echo "Installing Python dependencies"
pip install "python-socketio[client]" requests || true
echo "Optional: if you plan to use OpenCV-based streaming, install opencv-python now (may take a while)"
echo "To install OpenCV: pip install opencv-python"

echo "If you have not already copied the client scripts into $CLIENT_DIR, copy them now."
echo "Example (from your workstation): scp backend/iot/pi_copied/DP-Group-17/Scripts/*.py pi@<PI_IP>:$CLIENT_DIR/"

echo "Move the systemd unit into place (if present in $CLIENT_DIR)"
if [ -f "$CLIENT_DIR/ew-pi-client.service" ]; then
  sudo mv "$CLIENT_DIR/ew-pi-client.service" /etc/systemd/system/ew-pi-client.service
  echo "Moved service to /etc/systemd/system/ew-pi-client.service"
  sudo systemctl daemon-reload
  sudo systemctl enable ew-pi-client.service
  sudo systemctl start ew-pi-client.service
  echo "Started ew-pi-client.service"
  echo "Check logs with: sudo journalctl -u ew-pi-client.service -f"
else
  echo "No service file found in $CLIENT_DIR — please place ew-pi-client.service in that directory or follow manual instructions in PI_SETUP.md"
fi

echo "Done. If you need to run the client manually in this session, activate venv: source $VENV_DIR/bin/activate && python $CLIENT_DIR/pi_client.py --name pi_home --server https://YOUR_BACKEND_URL"
