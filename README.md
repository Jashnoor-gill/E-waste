# E-Waste Management & Recycling Platform

A full-stack platform for managing e-waste collection, recycling, and awareness. Features real-time IoT bin status, dashboards for users, collectors, and admins, notifications, and analytics.

## Features
- Real-time bin status (IoT, Socket.io)
- Role-based dashboards (Bin User, Collector, Admin)
- Deposit and collection workflows
- PCB recycling workflow (demo)
- In-app, email, and SMS notifications
- Statistics and impact analytics (charts, progress bars)
- Responsive, modern UI/UX

## Tech Stack
- **Frontend:** HTML, CSS, JavaScript, Chart.js
- **Backend:** Node.js, Express, Socket.io
- **Database:** MongoDB
- **Notifications:** Nodemailer (email), Twilio (SMS)

## Getting Started
1. Clone the repo:
	```
	git clone https://github.com/Jashnoor-gill/E-waste.git
	```
2. Install backend dependencies:
	```
	cd backend
	npm install
	```
3. Copy `.env.example` to `.env` and fill in your credentials

## IoT Device Tokens

To secure device registration, you can configure one or more device tokens in your backend environment. Set `DEVICE_TOKENS` (comma-separated) in your backend `.env` or in Render environment variables. When set, IoT devices must send a token during registration.

Example in `.env`:

```
DEVICE_TOKENS=raspi-secret-token,another-token
```

On the Pi, provide the token either via environment variable or CLI:

```bash
export DEVICE_TOKEN=raspi-secret-token
python iot/pi_client.py --name raspi-1
```

Or with CLI option:

```bash
python iot/pi_client.py --name raspi-1 --token raspi-secret-token
```
4. Start backend:
	```
	npm run dev
	```
5. Start frontend:
	```
	cd ../frontend
	npx serve -l 3000
	```
6. Open `http://localhost:3000` in your browser

## Environment Variables
See `backend/.env.example` for required variables. **Never commit your real `.env` file.**

## License
MIT
