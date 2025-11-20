# Raspberry Pi client (raspi-1)

This folder contains the Raspberry Pi client and helper scripts.

Files added:
- `pi_client.py` — main client (already present)
- `requirements.txt` — Python deps (already present)
- `run.sh` — helper to create venv and run the client
- `install_and_enable_service.sh` — helper to create venv and instructions to enable systemd
- `raspi-client.service` — example systemd unit (edit paths/user as needed)
- `update_and_restart.sh` — helper to pull updates and restart service

Quick start on the Pi (recommended: run from `/home/pi/E-waste/raspberry/raspi-1`):

1) Create venv and install deps
```bash
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt
```

2) Run client in background (example)
```bash
pkill -f pi_client.py || true
nohup .venv/bin/python pi_client.py --server https://e-waste-backend-3qxc.onrender.com --name raspi-1 > pi_client.log 2>&1 &
tail -f pi_client.log
```

3) Optional: enable systemd service (run as a user with sudo)
```bash
sudo cp raspi-client.service /etc/systemd/system/
# edit the file if your paths or user differ
sudo systemctl daemon-reload
sudo systemctl enable --now raspi-client.service
sudo journalctl -u raspi-client.service -f
```

4) Update & restart helper
```bash
./update_and_restart.sh
```

Push this folder to a new GitHub repo
1) Create an empty repo on GitHub (e.g. `E-waste-raspi-client`) via the website.
2) From the `raspberry/raspi-1` folder locally:
```bash
git init
git add .
git commit -m "initial raspi client snapshot"
git remote add origin https://github.com/<YOUR_USER>/E-waste-raspi-client.git
git branch -M main
git push -u origin main
```

Or using `gh` (GitHub CLI):
```bash
gh repo create <YOUR_USER>/E-waste-raspi-client --public --source=. --remote=origin
```

That's it — the client will now be versioned separately and you can pull/push updates and restart the service with the helper scripts.
