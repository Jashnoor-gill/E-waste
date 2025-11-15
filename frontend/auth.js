// Simple frontend auth helper: handles register/login flows and stores JWT in localStorage
const API_BASE = window.__API_BASE__ || '/api';

async function requestJson(path, body) {
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw data;
  return data;
}

export async function register(formEl) {
  const fd = new FormData(formEl);
  const body = { name: fd.get('name'), username: fd.get('username'), email: fd.get('email'), password: fd.get('password') };
  const r = await requestJson('/auth/register', body);
  if (r && r.token) {
    localStorage.setItem('ew_token', r.token);
    localStorage.setItem('ew_user', JSON.stringify(r.user));
    window.location.href = 'dashboard.html';
  }
}

export async function login(formEl) {
  const fd = new FormData(formEl);
  // Send username (or identifier) to the backend
  const body = { username: fd.get('username'), password: fd.get('password') };
  const r = await requestJson('/auth/login', body);
  if (r && r.token) {
    localStorage.setItem('ew_token', r.token);
    localStorage.setItem('ew_user', JSON.stringify(r.user));
    window.location.href = 'dashboard.html';
  }
}

export function logout() {
  localStorage.removeItem('ew_token');
  localStorage.removeItem('ew_user');
  window.location.href = 'index.html';
}

export function authFetch(input, init={}) {
  const token = localStorage.getItem('ew_token');
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', 'Bearer ' + token);
  return fetch(input, { ...init, headers });
}
