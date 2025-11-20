#!/usr/bin/env bash
set -euo pipefail
# install_and_enable_service.sh
# Creates venv, installs deps and prints systemd unit instructions

BASEDIR="$(cd "$(dirname "$0")" && pwd)"
cd "$BASEDIR"

echo "Creating virtualenv and installing requirements..."
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
if [ -f requirements.txt ]; then
  .venv/bin/pip install -r requirements.txt
fi

echo
echo "Virtualenv ready at $BASEDIR/.venv"
echo
echo "To enable automatic start with systemd (run as pi or sudo user):"
echo "  1) Copy the unit file template (raspi-client.service) to /etc/systemd/system/"
echo "     sudo cp raspi-client.service /etc/systemd/system/"
echo "  2) Edit the file to adjust the 'User' and ExecStart paths if needed"
echo "  3) Reload systemd and enable the service:
echo "     sudo systemctl daemon-reload
echo "     sudo systemctl enable --now raspi-client.service"
echo
echo "Use 'journalctl -u raspi-client.service -f' to follow logs"
