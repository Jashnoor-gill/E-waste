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
    if (typeof window !== 'undefined') {
      window.ENABLE_MOCK = !!on;
      // expose global helpers for non-module scripts (sidebar.js, inline scripts)
      try { window.setMockEnabled = setMockEnabled; } catch (e) {}
      try { window.getMockEnabled = getMockEnabled; } catch (e) {}
      // dispatch a site-wide event so other scripts can react
      try { window.dispatchEvent(new CustomEvent('mock-mode-changed', { detail: { enabled: !!on } })); } catch (e) {}
    }
  } catch (e) {}
}

export function getMockEnabled() {
  try { if (typeof window !== 'undefined') return window.ENABLE_MOCK !== false; } catch (e) {}
  return true;
}

// Also expose helpers on `window` for compatibility with non-module scripts
try { if (typeof window !== 'undefined') { window.setMockEnabled = setMockEnabled; window.getMockEnabled = getMockEnabled; } } catch (e) {}

// Ensure a sensible default for demo mode so pages load with mock data available.
try {
  if (typeof window !== 'undefined') {
    // If localStorage has an explicit setting, respect it; otherwise default ON
    const stored = (() => { try { return localStorage.getItem('ENABLE_MOCK'); } catch (e) { return null; } })();
    if (stored === null) {
      // set default true so the demo works out-of-the-box
      window.setMockEnabled(true);
      try { localStorage.setItem('ENABLE_MOCK', 'true'); } catch (e) {}
    } else {
      // apply stored preference
      window.setMockEnabled(stored === 'true');
    }
  }
} catch (e) { /* non-fatal */ }

// Add more API calls as needed
