// Simple API utility for frontend (mobile/LAN friendly)
// If served over LAN (http://<PC_IP>:<port>), use that host for API as well.
const HOST = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : 'localhost';
const API_BASE = `http://${HOST}:5000/api`;

export async function getBins() {
  const res = await fetch(`${API_BASE}/bins`);
  return res.json();
}

export async function getStats() {
  const res = await fetch(`${API_BASE}/stats`);
  return res.json();
}

export async function getEvents() {
  const res = await fetch(`${API_BASE}/events`);
  return res.json();
}

// Add more API calls as needed
