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

  if (captureBtn) captureBtn.addEventListener('click', requestCapture);
  if (runBtn) runBtn.addEventListener('click', requestRunModel);
  if (webcamStartBtn) webcamStartBtn.addEventListener('click', startWebcam);
  if (webcamStopBtn) webcamStopBtn.addEventListener('click', stopWebcam);
  if (webcamCaptureBtn) webcamCaptureBtn.addEventListener('click', captureFromWebcam);
  if (webcamOneClickBtn) webcamOneClickBtn.addEventListener('click', oneClickCapture);

  socket.on('connect', () => {
    console.log('IoT socket connected', socket.id);
  });

  socket.on('iot-photo', (payload) => {
    console.log('Received iot-photo', payload);
    showCaptureLoading(false);
    if (imgContainer && payload && payload.imageBase64) {
      imgContainer.innerHTML = `<img src="data:image/jpeg;base64,${payload.imageBase64}" style="max-width:100%; border-radius:8px;"/>`;
    } else if (imgContainer && payload && payload.error) {
      imgContainer.innerHTML = `<div class="card" style="padding:1rem; color:#c62828">Capture error: ${payload.error}</div>`;
    }
  });

  socket.on('iot-model-result', (payload) => {
    console.log('Received iot-model-result', payload);
    showModelLoading(false);
    renderModelResult(payload);
  });
}

// Browser webcam helpers --------------------------------------------------
let _webcamStream = null;
const VIDEO_ID = 'webcamVideo';

async function startWebcam() {
  try {
    const v = document.getElementById(VIDEO_ID);
    if (!v) return alert('No video element found on page');
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
  const v = document.getElementById(VIDEO_ID);
  const imgContainer = document.getElementById('iotImageContainer');
  if (!v || !v.srcObject) return alert('Camera not started');
  showModelLoading(true);
  // draw current frame to canvas
  const canvas = document.createElement('canvas');
  canvas.width = v.videoWidth || 1280;
  canvas.height = v.videoHeight || 720;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
  // convert to JPEG base64
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const b64 = dataUrl.split(',')[1];

  if (imgContainer) imgContainer.innerHTML = `<img src="${dataUrl}" style="max-width:100%; border-radius:8px;"/>`;

  try {
  const body = { image_b64: b64, replySocketId: socket.id };
    // if frontend mock mode is enabled, tell backend to return a canned result instead of calling PyTorch
    if (typeof getMockEnabled === 'function' && getMockEnabled()) {
      body.mock = true;
    }
    // POST to same origin backend when available (local dev), otherwise fall back to DEFAULT_BACKEND
    const runModelUrl = `${ORIGIN.replace(/\/$/, '')}/api/iot/run-model`;
    const res = await fetch(runModelUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    console.log('run-model (webcam) response', data);
    // backend will forward result to socket; also HTTP response contains result when ready
    if (data && data.result) {
      renderModelResult(data.result);
      showModelLoading(false);
    }
  } catch (err) {
    console.error('webcam run-model failed', err);
    alert('Run model failed: ' + (err.message || err));
    showModelLoading(false);
  }
}

// One-click flow: start camera, capture one frame, send it, then stop camera.
async function oneClickCapture() {
  const v = document.getElementById(VIDEO_ID);
  const imgContainer = document.getElementById('iotImageContainer');
  try {
    showModelLoading(true);
    // start camera (will reuse if already started)
    if (!v || !v.srcObject) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
      v.srcObject = stream;
      // small delay to allow camera to warm up
      await new Promise(r => setTimeout(r, 250));
    }

    // draw frame
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth || 1280;
    canvas.height = v.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const b64 = dataUrl.split(',')[1];
    if (imgContainer) imgContainer.innerHTML = `<img src="${dataUrl}" style="max-width:100%; border-radius:8px;"/>`;

    const body = { image_b64: b64, replySocketId: socket.id };
    if (typeof getMockEnabled === 'function' && getMockEnabled()) body.mock = true;
    const runModelUrl = `${ORIGIN.replace(/\/$/, '')}/api/iot/run-model`;
    const res = await fetch(runModelUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
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
    const data = await res.json();
    console.log('capture requested', data);
    // waiting for 'iot-photo' event
  } catch (err) {
    console.error('capture request failed', err);
    alert('Capture request failed: ' + err.message);
  }
}

async function requestRunModel() {
  try {
    const body = { replySocketId: socket.id };
    showModelLoading(true);
  const runModelUrl = `${ORIGIN.replace(/\/$/, '')}/api/iot/run-model`;
  const res = await fetch(runModelUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    console.log('run-model requested', data);
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

// Auto-start camera when visiting dashboard.html with ?autostart=1
try {
  const params = new URLSearchParams(window.location.search || '');
  if (params.get('autostart') === '1') {
    // Delay slightly to allow DOM and permissions prompt to settle
    setTimeout(() => {
      startWebcam().catch(err => console.warn('Auto-start webcam failed', err));
    }, 250);
  }
} catch (e) {
  // ignore
}

export { requestCapture, requestRunModel, socket };
