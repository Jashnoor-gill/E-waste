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
