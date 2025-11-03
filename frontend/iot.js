import { io as ioClient } from 'https://cdn.socket.io/4.7.5/socket.io.esm.min.js';

// Connect to backend socket.io (same URL used in socket.js)
const SOCKET_URL = 'https://e-waste-backend-3qxc.onrender.com';
const socket = ioClient(SOCKET_URL);

// Expose to window for quick debugging
window.iotSocket = socket;

// UI helper: attach handlers if buttons exist
function setupUi() {
  const captureBtn = document.getElementById('iotCaptureBtn');
  const runBtn = document.getElementById('iotRunModelBtn');
  const imgContainer = document.getElementById('iotImageContainer');
  const resultContainer = document.getElementById('iotModelResult');

  if (captureBtn) captureBtn.addEventListener('click', requestCapture);
  if (runBtn) runBtn.addEventListener('click', requestRunModel);

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
    if (resultContainer) {
      resultContainer.textContent = JSON.stringify(payload, null, 2);
    }
  });
}

async function requestCapture() {
  try {
    // include our socket id so server can route the response only to us
    const body = { replySocketId: socket.id };
    // show a simple loading state
    showCaptureLoading(true);
    const res = await fetch('https://e-waste-backend-3qxc.onrender.com/api/iot/capture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
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
    const res = await fetch('https://e-waste-backend-3qxc.onrender.com/api/iot/run-model', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
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

export { requestCapture, requestRunModel, socket };
