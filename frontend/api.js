// Simple API utility for frontend (mobile/LAN friendly)
// Prefer a runtime-configured backend (window.BACKEND_URL) when available.
// Default to local relative `/api` when no BACKEND_URL is provided so the
// frontend works when served by the backend in development.
const API_BASE = (typeof window !== 'undefined' && window.BACKEND_URL)
  ? `${window.BACKEND_URL.replace(/\/$/, '')}/api`
  : (typeof window !== 'undefined' ? '/api' : 'http://localhost:5000/api');

// Mock helper: currently we keep requests pointed at the real backend, but
// exposing `withMock` and `getMockEnabled` allows the site to enable/disable
// lightweight mock behavior from the page (e.g. for demos). By default mock
// mode is ON unless explicitly disabled via `window.ENABLE_MOCK = false`.
function withMock(url) { return url; }

// Import authFetch for authenticated requests (adds Authorization header)
import { authFetch } from './auth.js';

export async function getBins() {
  if (getMockEnabled()) {
    // lightweight mock bins containing various e-waste item types
    return Promise.resolve([
      { id: 'bin-1', name: 'Electronics Drop 1', location: 'Library', items: ['mobile', 'charger', 'headphones'], capacityKg: 50, fillKg: 12.4 },
      { id: 'bin-2', name: 'Lab Bin A', location: 'Lab Block', items: ['pcb', 'cable', 'charger'], capacityKg: 80, fillKg: 36.2 },
      { id: 'bin-3', name: 'Hostel Bin', location: 'Hostel 3', items: ['mobile', 'cable'], capacityKg: 60, fillKg: 8.1 },
      { id: 'bin-4', name: 'Office Bin', location: 'Admin Office', items: ['pc', 'charger', 'headphones'], capacityKg: 40, fillKg: 21.0 }
    ]);
  }
  const res = await fetch(withMock(`${API_BASE}/bins`));
  return res.json();
}

export async function getStats() {
  if (getMockEnabled()) {
    // Mock stats and chart-ready series for dashboard
    return Promise.resolve({
      totalEwasteKg: 128.7,
      totalEvents: 342,
      co2SavedKg: 320.5,
      energySavedKWh: 450.2,
      pointsEarned: 1240,
      byCategory: {
        mobile: 34.2,
        pcb: 22.5,
        cable: 18.0,
        charger: 27.0,
        headphones: 11.0,
        other: 16.0
      },
      chartSeries: {
        labels: ['Mobile','PCB','Cable','Charger','Headphones','Other'],
        data: [34.2,22.5,18.0,27.0,11.0,16.0]
      }
    });
  }
  const res = await fetch(withMock(`${API_BASE}/stats`));
  return res.json();
}

export async function getDepositSeries() {
  if (getMockEnabled()) {
    // Mock deposit-over-time series (last 12 months)
    const labels = [];
    const data = [];
    const now = new Date();
    for (let i = 11; i >= 0; --i) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(d.toLocaleString(undefined, { month: 'short', year: 'numeric' }));
      // random but plausible monthly deposit in kg
      data.push(Math.round((Math.random() * 30 + 10) * 10) / 10);
    }
    return Promise.resolve({ labels, data });
  }
  const res = await fetch(withMock(`${API_BASE}/stats/deposit-series`));
  return res.json();
}

export async function getEvents() {
  if (getMockEnabled()) {
    const now = new Date();
    return Promise.resolve([
      { id: 'ev-1', user: 'demo_user', binId: 'bin-1', category: 'mobile', weightKg: 0.2, timestamp: new Date(now.getTime() - 1000*60*60).toISOString() },
      { id: 'ev-2', user: 'demo_user', binId: 'bin-2', category: 'pcb', weightKg: 1.2, timestamp: new Date(now.getTime() - 1000*60*30).toISOString() },
      { id: 'ev-3', user: 'demo_user', binId: 'bin-3', category: 'cable', weightKg: 0.15, timestamp: new Date(now.getTime() - 1000*60*10).toISOString() }
    ]);
  }
  const res = await fetch(withMock(`${API_BASE}/events`));
  return res.json();
}

export async function postEvent(eventData) {
  // Use authFetch so events are tied to authenticated user when token present
  const res = await authFetch(withMock(`${API_BASE}/events`), {
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
  if (getMockEnabled()) {
    return Promise.resolve([
      { id: 'u-demo', username: 'demo_user', name: 'Demo User', role: 'user' },
      { id: 'u-admin', username: 'admin', name: 'Administrator', role: 'admin' }
    ]);
  }
  const res = await fetch(withMock(`${API_BASE}/users`));
  return res.json();
}

// Device management API (admin)
export async function getDevices(adminToken) {
  if (getMockEnabled()) {
    return Promise.resolve([
      { id: 'raspi-1', name: 'raspi-1', lastSeen: new Date().toISOString(), status: 'online' }
    ]);
  }
  const res = await fetch(`${API_BASE}/device-mgmt/devices`, { headers: { 'x-admin-token': adminToken } });
  return res.json();
}

export async function getDeviceTokens(adminToken) {
  const res = await fetch(`${API_BASE}/device-mgmt/tokens`, { headers: { 'x-admin-token': adminToken } });
  return res.json();
}

export async function addDeviceToken(adminToken, token) {
  const res = await fetch(`${API_BASE}/device-mgmt/tokens`, { method: 'POST', headers: { 'x-admin-token': adminToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
  return res.json();
}

export async function removeDeviceToken(adminToken, token) {
  const res = await fetch(`${API_BASE}/device-mgmt/tokens/${encodeURIComponent(token)}`, { method: 'DELETE', headers: { 'x-admin-token': adminToken } });
  return res.json();
}

// Bin management
export async function createBin(data) {
  const res = await fetch(withMock(`${API_BASE}/bins`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Create bin failed: ${res.status}`);
  return res.json();
}

export async function updateBin(id, data) {
  const res = await fetch(withMock(`${API_BASE}/bins/${id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Update bin failed: ${res.status}`);
  return res.json();
}

export async function deleteBin(id) {
  const res = await fetch(withMock(`${API_BASE}/bins/${id}`), { method: 'DELETE' });
  if (!res.ok) throw new Error(`Delete bin failed: ${res.status}`);
  return res.json();
}

// User management
export async function updateUser(id, data) {
  const res = await fetch(withMock(`${API_BASE}/users/${id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Update user failed: ${res.status}`);
  return res.json();
}

export async function deleteUser(id) {
  const res = await fetch(withMock(`${API_BASE}/users/${id}`), { method: 'DELETE' });
  if (!res.ok) throw new Error(`Delete user failed: ${res.status}`);
  return res.json();
}

// Stats management
export async function updateStats(data) {
  const res = await fetch(withMock(`${API_BASE}/stats`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Update stats failed: ${res.status}`);
  return res.json();
}

// No-op mock API: keep API surface minimal for compatibility
export function setMockEnabled(on) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('ENABLE_MOCK', on ? 'true' : 'false');
    }
  } catch (e) { /* ignore */ }
}

export function getMockEnabled() {
  try {
    if (typeof window !== 'undefined') {
      // Explicit global override via page-level config
      if (typeof window.ENABLE_MOCK !== 'undefined') return !!window.ENABLE_MOCK;
      const stored = window.localStorage ? window.localStorage.getItem('ENABLE_MOCK') : null;
      if (stored !== null) return stored === 'true';
      // Default to true for demo mode when not specified
      return true;
    }
  } catch (e) { /* ignore */ }
  return true;
}

// Add more API calls as needed
