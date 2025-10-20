// Simple API utility for frontend (mobile/LAN friendly)
// If served over LAN (http://<PC_IP>:<port>), use that host for API as well.
const API_BASE = 'https://e-waste-backend-3qxc.onrender.com/api';

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

export async function postEvent(eventData) {
  const res = await fetch(`${API_BASE}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(eventData)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to post event: ${res.status} ${text}`);
  }
  return res.json().catch(() => ({}));
}

export async function getUsers() {
  const res = await fetch(`${API_BASE}/users`);
  return res.json();
}

// Bin management
export async function createBin(data) {
  const res = await fetch(`${API_BASE}/bins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Create bin failed: ${res.status}`);
  return res.json();
}

export async function updateBin(id, data) {
  const res = await fetch(`${API_BASE}/bins/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Update bin failed: ${res.status}`);
  return res.json();
}

export async function deleteBin(id) {
  const res = await fetch(`${API_BASE}/bins/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Delete bin failed: ${res.status}`);
  return res.json();
}

// User management
export async function updateUser(id, data) {
  const res = await fetch(`${API_BASE}/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Update user failed: ${res.status}`);
  return res.json();
}

export async function deleteUser(id) {
  const res = await fetch(`${API_BASE}/users/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Delete user failed: ${res.status}`);
  return res.json();
}

// Stats management
export async function updateStats(data) {
  const res = await fetch(`${API_BASE}/stats`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Update stats failed: ${res.status}`);
  return res.json();
}

// Add more API calls as needed
