// Simple API utility for frontend
const API_BASE = 'http://localhost:5000/api';

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
