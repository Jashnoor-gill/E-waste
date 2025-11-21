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
  const res = await fetch(`${API_BASE}/bins`);
  return res.json();
}

export async function getStats() {
  const res = await fetch(`${API_BASE}/stats`);
  return res.json();
}

export async function getDepositSeries() {
  const res = await fetch(`${API_BASE}/stats/deposit-series`);
  return res.json();
}

export async function getEvents(userId) {
  let url = `${API_BASE}/events`;
  if (userId) url += `?user=${encodeURIComponent(userId)}`;
  const res = await fetch(url);
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
  const res = await fetch(`${API_BASE}/users`);
  return res.json();
}

// Device management API (admin)
export async function getDevices(adminToken) {
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
  // Deprecated: mock mode removed for production flows. No-op to preserve API.
  return;
}

export function getMockEnabled() {
  // Mock mode removed: always use real backend calls
  return false;
}

// Add more API calls as needed
