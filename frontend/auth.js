// Simple frontend auth helper: handles register/login flows and stores JWT in localStorage
const API_BASE = window.__API_BASE__ || '/api';

async function requestJson(path, body) {
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  // Try parsing JSON response; if that fails, return raw text for diagnostics
  let parsed;
  try { parsed = await res.json(); }
  catch (e) { parsed = await res.text().catch(() => null); }
  if (!res.ok) {
    // Throw an object containing status and server body to aid debugging
    const err = { status: res.status, body: parsed };
    throw err;
  }
  return parsed;
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
  try {
    const r = await requestJson('/auth/login', body);
    if (r && r.token) {
      localStorage.setItem('ew_token', r.token);
      localStorage.setItem('ew_user', JSON.stringify(r.user));
      window.location.href = 'dashboard.html';
      return;
    }
  } catch (err) {
    // If login failed due to invalid credentials or the remote does not
    // support login-first auto-create, attempt to register the user now.
    try {
      const serverErr = (err && err.body) ? err.body : err;
      const serverCode = serverErr && serverErr.error ? serverErr.error : null;
      if (err && (err.status === 401 || serverCode === 'invalid_credentials' || serverCode === 'not_found' || serverCode === 'identifier_or_username,password required')) {
        // Try to register the user with the same username/password
        const regBody = { username: body.username, password: body.password, name: body.username };
        const reg = await requestJson('/auth/register', regBody);
        if (reg && reg.token) {
          localStorage.setItem('ew_token', reg.token);
          localStorage.setItem('ew_user', JSON.stringify(reg.user));
          window.location.href = 'dashboard.html';
          return;
        }
      }
    } catch (regErr) {
      // If registration also failed, surface the original login error
      throw regErr;
    }
    // If not handled above, rethrow the original error
    throw err;
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
