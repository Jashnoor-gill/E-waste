import { io as ioClient } from 'https://cdn.socket.io/4.7.5/socket.io.esm.min.js';
import { getMockEnabled } from './api.js';

// Connect to backend socket.io. Use the current page origin so local dev points to local backend
const DEFAULT_BACKEND = 'https://e-waste-backend-3qxc.onrender.com';
// Allow an explicit runtime-configured backend (useful when frontend is hosted on Netlify)
// You can create a small `config.js` that sets `window.BACKEND_URL = 'https://your-backend.onrender.com'`
const ORIGIN = (typeof window !== 'undefined' && window.BACKEND_URL) ? window.BACKEND_URL : ((typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null') ? window.location.origin : DEFAULT_BACKEND);
const SOCKET_URL = ORIGIN;
const socket = ioClient(SOCKET_URL);

// Expose to window for quick debugging
window.iotSocket = socket;
// If set to true (or '1'/'true') in a site-level config, the frontend will
// completely disable use of the local laptop webcam and only use Pi feeds.
const DISABLE_LOCAL_WEBCAM = (typeof window !== 'undefined' && (window.DISABLE_LOCAL_WEBCAM === true || window.DISABLE_LOCAL_WEBCAM === '1' || window.DISABLE_LOCAL_WEBCAM === 'true'));

// UI helper: attach handlers if buttons exist
function setupUi() {
  const captureBtn = document.getElementById('iotCaptureBtn');
  const runBtn = document.getElementById('iotRunModelBtn');
  const webcamStartBtn = document.getElementById('webcamStartBtn');
  const webcamStopBtn = document.getElementById('webcamStopBtn');
  const webcamCaptureBtn = document.getElementById('webcamCaptureBtn');
  const webcamOneClickBtn = document.getElementById('webcamOneClickBtn');
  const imgContainer = document.getElementById('iotImageContainer');
  const resultContainer = document.getElementById('iotModelResult');
  const startPiFeedBtn = document.getElementById('startPiFeedBtn');
  const stopPiFeedBtn = document.getElementById('stopPiFeedBtn');
  const startPiCameraBtn = document.getElementById('startPiCameraBtn');
  const stopPiCameraBtn = document.getElementById('stopPiCameraBtn');
  const piDeviceIdInput = document.getElementById('piDeviceIdInput');

  if (captureBtn) captureBtn.addEventListener('click', requestCapture);
  if (runBtn) runBtn.addEventListener('click', requestRunModel);
  if (DISABLE_LOCAL_WEBCAM) {
    // Hide/disable all local webcam controls when local webcam is disabled
    [webcamStartBtn, webcamStopBtn, webcamCaptureBtn, webcamOneClickBtn].forEach(b => { if (b) { b.style.display = 'none'; b.disabled = true; } });
    // Hide local video element if present
    try { const v = document.getElementById(VIDEO_ID); if (v) v.style.display = 'none'; } catch(e){}
  } else {
    if (webcamStartBtn) webcamStartBtn.addEventListener('click', () => startPreferredCamera());
    if (webcamStopBtn) webcamStopBtn.addEventListener('click', stopWebcam);
    if (webcamCaptureBtn) webcamCaptureBtn.addEventListener('click', captureFromWebcam);
    if (webcamOneClickBtn) webcamOneClickBtn.addEventListener('click', oneClickCapture);
  }
  if (startPiFeedBtn) startPiFeedBtn.addEventListener('click', () => startPiFeed());
  if (stopPiFeedBtn) stopPiFeedBtn.addEventListener('click', () => stopPiFeed());
  if (startPiCameraBtn) startPiCameraBtn.addEventListener('click', () => startPiCamera());
  if (stopPiCameraBtn) stopPiCameraBtn.addEventListener('click', () => stopPiCamera());
  // If browser does not support getUserMedia, disable webcam controls with a helpful title
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    const note = 'Camera unavailable (requires HTTPS or localhost and browser support)';
    [webcamStartBtn, webcamStopBtn, webcamCaptureBtn, webcamOneClickBtn].forEach(b => {
      if (b) { b.disabled = true; b.title = note; }
    });
  }
  // If page is not a secure context (HTTPS) and not localhost, show a small hint
  const insecure = (typeof window !== 'undefined' && !window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1');
  if (insecure) {
    const hint = document.createElement('div');
    hint.style.margin = '0.5rem 0';
    hint.style.padding = '0.5rem 0.75rem';
    hint.style.background = '#fff3e0';
    hint.style.border = '1px solid #ffd54f';
    hint.style.borderRadius = '8px';
    hint.style.color = '#6a4f00';
    hint.style.fontSize = '0.95rem';
    hint.textContent = 'Camera features are disabled on non-secure pages. Preview camera functionality will work on the deployed site (HTTPS) or on localhost.';
    try { const container = document.getElementById('iotImageContainer') || document.body; container.insertBefore(hint, container.firstChild); } catch (e) { /* ignore */ }
  }
  // wire prominent test button if present
  const testBtn = document.getElementById('testCameraBtn');
  if (testBtn) testBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      // Ensure camera started, then do one-click capture
      const v = document.getElementById(VIDEO_ID);
      if (!v || !v.srcObject) {
        await startWebcam();
        // small delay for camera warmup
        await new Promise(r => setTimeout(r, 300));
      }
      await oneClickCapture();
    } catch (err) {
      console.error('Test camera failed', err);
      alert('Test camera failed: ' + (err.message || err));
    }
  });

  socket.on('connect', () => {
    console.log('IoT socket connected', socket.id);
    updateStatus();
  });

  socket.on('iot-photo', (payload) => {
    console.log('Received iot-photo', payload);
    showCaptureLoading(false);
    // Accept multiple possible keys from various Pi/client implementations
    const imgB64 = payload && (payload.imageBase64 || payload.image_b64 || payload.image || payload.frame || payload.img);
    if (imgContainer && imgB64) {
      imgContainer.innerHTML = `<img src="data:image/jpeg;base64,${imgB64}" style="max-width:100%; border-radius:8px;"/>`;
      // If device id is provided, persist the received frame to the frame server
      try {
        const deviceId = payload.device || payload.device_id || (document.getElementById('piDeviceIdInput') && document.getElementById('piDeviceIdInput').value) || 'raspi-1';
        persistFrameToServer(deviceId, imgB64).catch((e) => console.warn('persistFrameToServer failed', e));
      } catch (e) { /* ignore */ }
    } else if (imgContainer && payload && payload.error) {
      imgContainer.innerHTML = `<div class="card" style="padding:1rem; color:#c62828">Capture error: ${payload.error}</div>`;
    }
    // allow next periodic capture to run
    try { _piCaptureInFlight = false; } catch(e){}
  });

  // Persist an incoming base64 frame to the backend frame server so
  // `GET /api/frame/latest_frame` and SSE `/api/frame/stream/:deviceId` can be used.
  async function persistFrameToServer(deviceId, base64Frame) {
    if (!deviceId || !base64Frame) return;
    try {
      const url = `${ORIGIN.replace(/\/$/, '')}/api/frame/upload_frame`;
      const body = { device_id: deviceId, frame: base64Frame };
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        const txt = await res.text().catch(() => `Status ${res.status}`);
        console.warn('persistFrameToServer: upload failed', res.status, txt.slice(0,200));
      }
    } catch (err) {
      console.warn('persistFrameToServer error', err);
    }
  }

  socket.on('iot-model-result', (payload) => {
    console.log('Received iot-model-result', payload);
    showModelLoading(false);
    renderModelResult(payload);
    updateStatus();
  });

  // Remote Pi feed handlers (SSE + fetch latest)
  let _piEvt = null;
  let _piPolling = null;
  async function fetchAndUpdatePiFrame(deviceId) {
    try {
      const res = await fetch(`${ORIGIN.replace(/\/$/, '')}/api/frame/latest_frame?device_id=${encodeURIComponent(deviceId)}`);
      if (!res.ok) return;
      const j = await res.json();
      if (j && j.frame) {
        const img = document.getElementById('remoteFrameImg');
        if (img) {
          img.src = 'data:image/jpeg;base64,' + j.frame;
          img.style.display = 'block';
        }
      }
    } catch (e) { console.warn('fetchAndUpdatePiFrame failed', e); }
  }

  function startPiFeed(deviceId) {
    deviceId = deviceId || ((piDeviceIdInput && piDeviceIdInput.value) ? piDeviceIdInput.value : 'raspi-1');
    // prefer SSE
    try {
      stopPiFeed();
      _piEvt = new EventSource(`${ORIGIN.replace(/\/$/, '')}/api/frame/stream/${encodeURIComponent(deviceId)}`);
      _piEvt.onmessage = (e) => {
        // when event arrives, fetch latest frame and update image
        fetchAndUpdatePiFrame(deviceId);
      };
      _piEvt.onerror = (err) => {
        console.warn('Pi feed SSE error', err);
        // fallback to polling every 2s
        if (!_piPolling) _piPolling = setInterval(() => fetchAndUpdatePiFrame(deviceId), 2000);
      };
      // initial fetch
      fetchAndUpdatePiFrame(deviceId);
    } catch (err) {
      console.warn('startPiFeed failed, falling back to polling', err);
      if (!_piPolling) _piPolling = setInterval(() => fetchAndUpdatePiFrame(deviceId), 2000);
    }
  }

  function stopPiFeed() {
    try {
      if (_piEvt) { _piEvt.close(); _piEvt = null; }
    } catch (e) { /* ignore */ }
    try { if (_piPolling) { clearInterval(_piPolling); _piPolling = null; } } catch (e) { }
    const img = document.getElementById('remoteFrameImg'); if (img) img.style.display = 'none';
  }

  // Check whether the Pi has a recent frame available. Returns true if a frame
  // timestamp is within `maxAgeSec` seconds.
  async function piHasRecentFrame(deviceId = 'raspi-1', maxAgeSec = 10) {
    try {
      const res = await fetch(`${ORIGIN.replace(/\/$/, '')}/api/frame/latest_frame?device_id=${encodeURIComponent(deviceId)}`);
      if (!res.ok) return false;
      const j = await res.json();
      if (!j) return false;
      // The frame endpoint may return an object with `timestamp` or `ts` or only `frame`;
      // attempt to use common fields and fall back to presence of `frame`.
      const ts = j.timestamp || j.ts || j.time || j.t || null;
      if (ts) {
        const age = (Date.now() - new Date(ts).getTime()) / 1000;
        return age <= maxAgeSec;
      }
      // if no timestamp, consider any returned frame as recent enough
      return !!j.frame;
    } catch (e) {
      console.warn('piHasRecentFrame error', e);
      return false;
    }
  }

  // Prefer Pi feed when available; otherwise start local webcam.
  async function startPreferredCamera(deviceId = 'raspi-1') {
    try {
      const hasPi = await piHasRecentFrame(deviceId, 10);
      if (hasPi) {
        // stop local webcam if running
        try { if (_webcamStream) { stopWebcam(); } } catch(e){}
        // start Pi feed
        startPiFeed(deviceId);
      } else {
        // fall back to local webcam unless local webcam usage is disabled
        if (DISABLE_LOCAL_WEBCAM) {
          // Inform user and do not start local camera
          try { alert('No Pi feed available and local webcam usage is disabled by site configuration.'); } catch(e) {}
          return;
        }
        await startWebcam();
      }
    } catch (err) {
      console.warn('startPreferredCamera failed', err);
      // fallback: start webcam
      try { if (!DISABLE_LOCAL_WEBCAM) await startWebcam(); } catch(e){}
    }
  }
  // Expose helpers so autostart and other scripts can call them from global scope
  try { window.startPreferredCamera = startPreferredCamera; window.startPiFeed = startPiFeed; window.stopPiFeed = stopPiFeed; } catch(e) {}
}

// Periodic capture loop (frontend-driven) to simulate a live Pi camera without changing Pi code.
let _piCameraInterval = null;
let _piCaptureInFlight = false;
let _piCameraIntervalMs = 3000; // default capture interval when camera is "on"

function startPiCamera(deviceId) {
  deviceId = deviceId || (document.getElementById('piDeviceIdInput') && document.getElementById('piDeviceIdInput').value) || 'raspi-1';
  // start feed (SSE + initial fetch)
  try { if (window.startPiFeed) window.startPiFeed(deviceId); } catch(e){}
  // avoid starting multiple intervals
  if (_piCameraInterval) return;
  _piCaptureInFlight = false;
  // immediate first capture
  (async () => {
    if (!_piCaptureInFlight) {
      try { _piCaptureInFlight = true; await requestCapture(); } catch(e) { _piCaptureInFlight = false; }
    }
  })();
  _piCameraInterval = setInterval(async () => {
    if (_piCaptureInFlight) return;
    _piCaptureInFlight = true;
    try {
      await requestCapture();
    } catch (e) {
      console.warn('Periodic requestCapture failed', e);
      _piCaptureInFlight = false;
    }
  }, _piCameraIntervalMs);
  // update UI buttons if present
  try { const s = document.getElementById('startPiCameraBtn'); const t = document.getElementById('stopPiCameraBtn'); if (s) s.disabled = true; if (t) t.disabled = false; } catch(e){}
}

function stopPiCamera() {
  if (_piCameraInterval) { clearInterval(_piCameraInterval); _piCameraInterval = null; }
  _piCaptureInFlight = false;
  // stop feed if desired
  try { if (window.stopPiFeed) window.stopPiFeed(); } catch(e){}
  try { const s = document.getElementById('startPiCameraBtn'); const t = document.getElementById('stopPiCameraBtn'); if (s) s.disabled = false; if (t) t.disabled = true; } catch(e){}
}

try { window.startPiCamera = startPiCamera; window.stopPiCamera = stopPiCamera; } catch(e) {}

// Browser webcam helpers --------------------------------------------------
let _webcamStream = null;
const VIDEO_ID = 'webcamVideo';
let lastCapturedB64 = null; // store last captured image for explicit run

async function startWebcam() {
  try {
    const v = document.getElementById(VIDEO_ID);
    if (!v) return alert('No video element found on page');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const msg = 'Camera not available: your browser does not support getUserMedia or page is not served via HTTPS/localhost.';
      console.error('startWebcam failed - getUserMedia unavailable');
      return alert(msg + '\n\nTip: open this page over HTTPS or localhost and allow camera permission.');
    }
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
    v.srcObject = stream;
    v.style.display = 'block';
    _webcamStream = stream;
  } catch (err) {
    console.error('startWebcam failed', err);
    alert('Unable to access camera: ' + (err.message || err));
  }
}

function stopWebcam() {
  try {
    const v = document.getElementById(VIDEO_ID);
    if (v) v.style.display = 'none';
    if (_webcamStream) {
      _webcamStream.getTracks().forEach(t => t.stop());
      _webcamStream = null;
    }
  } catch (err) {
    console.error('stopWebcam failed', err);
  }
}

async function captureFromWebcam() {
  if (DISABLE_LOCAL_WEBCAM) return alert('Local webcam usage is disabled by site configuration.');
  const v = document.getElementById(VIDEO_ID);
  const imgContainer = document.getElementById('iotImageContainer');
  if (!v || !v.srcObject) return alert('Camera not started');
  // Capture frame and show it, but do not run the model automatically.
  showModelLoading(false);
  // draw current frame to canvas (resize to limit payload)
  const MAX_WIDTH = 800;
  const origW = v.videoWidth || 1280;
  const origH = v.videoHeight || 720;
  const scale = Math.min(1, MAX_WIDTH / origW);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(origW * scale);
  canvas.height = Math.round(origH * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
  // convert to JPEG base64 with reduced quality to avoid large payloads
  const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
  const b64 = dataUrl.split(',')[1];
  if (imgContainer) imgContainer.innerHTML = `<img src="${dataUrl}" style="max-width:100%; border-radius:8px;"/>`;
  // store captured image and enable Run Model button
  lastCapturedB64 = b64;
  try {
    const runBtn = document.getElementById('iotRunModelBtn');
    if (runBtn) runBtn.disabled = false;
  } catch (e) { /* ignore */ }
}

// One-click flow: start camera, capture one frame, send it, then stop camera.
async function oneClickCapture() {
  if (DISABLE_LOCAL_WEBCAM) return alert('Local webcam usage is disabled by site configuration.');
  const v = document.getElementById(VIDEO_ID);
  const imgContainer = document.getElementById('iotImageContainer');
  try {
    showModelLoading(true);
    // start camera (will reuse if already started)
    if (!v || !v.srcObject) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const msg = 'Camera not available: your browser does not support getUserMedia or page is not served via HTTPS/localhost.';
        console.error('oneClickCapture failed - getUserMedia unavailable');
        throw new Error(msg + ' Tip: open this page over HTTPS or localhost and allow camera permission.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
      v.srcObject = stream;
      // small delay to allow camera to warm up
      await new Promise(r => setTimeout(r, 250));
    }

    // draw frame
    const MAX_WIDTH = 800;
    const origW = v.videoWidth || 1280;
    const origH = v.videoHeight || 720;
    const scale = Math.min(1, MAX_WIDTH / origW);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(origW * scale);
    canvas.height = Math.round(origH * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    const b64 = dataUrl.split(',')[1];
    if (imgContainer) imgContainer.innerHTML = `<img src="${dataUrl}" style="max-width:100%; border-radius:8px;"/>`;

  const body = { image_b64: b64, replySocketId: socket.id };
  const runModelUrl = `${ORIGIN.replace(/\/$/, '')}/api/iot/run-model`;
    const res = await fetch(runModelUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    // handle non-JSON error pages (e.g. 413) gracefully
    if (!res.ok) {
      const txt = await res.text().catch(() => `Status ${res.status}`);
      throw new Error(`Server error ${res.status}: ${txt.slice(0,200)}`);
    }
    let data;
    try { data = await res.json(); }
    catch (e) {
      const txt = await res.text().catch(() => 'Invalid JSON response');
      throw new Error('Invalid JSON response: ' + txt.slice(0,200));
    }
    if (data && data.result) renderModelResult(data.result);
    showModelLoading(false);
  } catch (err) {
    console.error('oneClickCapture failed', err);
    alert('Capture failed: ' + (err.message || err));
    showModelLoading(false);
  } finally {
    // stop camera if we started it here
    try {
      const v2 = document.getElementById(VIDEO_ID);
      if (v2 && v2.srcObject) {
        const tracks = v2.srcObject.getTracks();
        tracks.forEach(t => t.stop());
        v2.srcObject = null;
      }
    } catch (e) { /* ignore */ }
  }
}

function renderModelResult(result) {
  const rc = document.getElementById('iotModelResult');
  if (!rc) return;
  // Accept both { requestId, result: { label, confidence } } and direct result
  const payload = result.result ? result.result : result;
  const label = payload.label || 'Unknown';
  const confidence = typeof payload.confidence === 'number' ? payload.confidence : (payload.conf ? payload.conf : 0);

  rc.innerHTML = `
    <div class="iot-result-card">
      <div class="iot-result-label">${label}</div>
      <div class="iot-result-confidence">Confidence: ${(confidence * 100).toFixed(1)}%</div>
      <div class="confidence-bar"><div class="confidence-fill" style="width:${Math.max(0, Math.min(100, confidence*100))}%"></div></div>
      <div class="iot-result-source">Source: ${payload.source || 'server'}</div>
    </div>
  `;
}

async function requestCapture() {
  try {
    // include our socket id so server can route the response only to us
    const body = { replySocketId: socket.id };
    // show a simple loading state
    showCaptureLoading(true);
  const captureUrl = `${ORIGIN.replace(/\/$/, '')}/api/iot/capture`;
  const res = await fetch(captureUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) {
      const txt = await res.text().catch(() => `Status ${res.status}`);
      throw new Error(`Server error ${res.status}: ${txt.slice(0,200)}`);
    }
    let data;
    try { data = await res.json(); }
    catch (e) { const txt = await res.text().catch(()=> 'Invalid JSON'); throw new Error('Invalid JSON response: '+txt.slice(0,200)); }
    console.log('capture requested', data);
    // waiting for 'iot-photo' event
  } catch (err) {
    console.error('capture request failed', err);
    alert('Capture request failed: ' + err.message);
  }
}

async function requestRunModel() {
  try {
    showModelLoading(true);
  const runModelUrl = `${ORIGIN.replace(/\/$/, '')}/api/iot/run-model`;
    let body = { replySocketId: socket.id };
    // If there's a captured image from the webcam, send it explicitly.
    if (lastCapturedB64) {
      body = { image_b64: lastCapturedB64, replySocketId: socket.id };
      // clear stored image after sending
      lastCapturedB64 = null;
      try { const runBtn = document.getElementById('iotRunModelBtn'); if (runBtn) runBtn.disabled = true; } catch(e){}
    }
  const res = await fetch(runModelUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) {
      const txt = await res.text().catch(() => `Status ${res.status}`);
      throw new Error(`Server error ${res.status}: ${txt.slice(0,200)}`);
    }
    let data;
    try { data = await res.json(); }
    catch (e) { const txt = await res.text().catch(()=> 'Invalid JSON'); throw new Error('Invalid JSON response: '+txt.slice(0,200)); }
    console.log('run-model requested', data);
    // Render result returned directly or wrapped in { result: { ... } }
    try {
      if (data && data.result) renderModelResult(data.result);
      else if (data) renderModelResult(data);
    } catch (err) {
      console.warn('Failed to render model result', err);
    }
    showModelLoading(false);
  } catch (err) {
    console.error('run model request failed', err);
    alert('Run model request failed: ' + err.message);
  }
}

function showCaptureLoading(show) {
  const imgContainer = document.getElementById('iotImageContainer');
  if (!imgContainer) return;
  if (show) imgContainer.innerHTML = `<div class="card" style="padding:1rem; text-align:center">Capturing... <div class="spinner" style="margin-top:0.5rem"></div></div>`;
}

function showModelLoading(show) {
  const resultContainer = document.getElementById('iotModelResult');
  if (!resultContainer) return;
  if (show) resultContainer.textContent = 'Running model...';
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupUi);
else setupUi();

// Auto-start webcam when requested via query param (e.g. dashboard.html?autostart=1).
try {
  const path = (window.location && window.location.pathname) ? window.location.pathname : '';
  const isDashboard = path.endsWith('dashboard.html') || path === '/' || path.endsWith('/');
  const params = new URLSearchParams(window.location.search);
  const auto = params.get('autostart') === '1' || params.get('autostart') === 'true';
  // Only auto-start if we're on the dashboard and `autostart=1` is present.
    if (isDashboard && auto) {
    setTimeout(() => {
        // startPreferredCamera is defined inside setupUi and exposed on window by setupUi
        try { if (window.startPreferredCamera) window.startPreferredCamera().catch(err => console.warn('Auto-start camera failed', err)); }
        catch(e) { console.warn('Auto-start camera invocation failed', e); }
    }, 250);
  }
} catch (e) { /* ignore */ }

// Status indicator: updates socket and backend health in the dashboard.
function setStatus(text, color) {
  try {
    const el = document.getElementById('iotStatus');
    if (!el) return;
    el.textContent = 'Status: ' + text;
    if (color) el.style.color = color;
  } catch (e) { /* ignore */ }
}

async function checkBackend() {
  try {
    const res = await fetch(`${ORIGIN.replace(/\/$/, '')}/api/bins`, { method: 'GET', cache: 'no-store' });
    if (res.ok) return true;
  } catch (e) { /* ignore */ }
  return false;
}

async function updateStatus() {
  const socketOk = !!(window.iotSocket && window.iotSocket.connected);
  const backendOk = await checkBackend();
  const parts = [];
  if (socketOk) parts.push('Socket: connected'); else parts.push('Socket: disconnected');
  if (backendOk) parts.push('Backend: OK'); else parts.push('Backend: unreachable');
  const color = (socketOk && backendOk) ? '#1a7f37' : '#c62828';
  setStatus(parts.join(' • '), color);
}

// keep status current
setInterval(updateStatus, 8000);
updateStatus();

export { requestCapture, requestRunModel, socket };
