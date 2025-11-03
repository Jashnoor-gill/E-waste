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
    if (imgContainer && payload && payload.imageBase64) {
      imgContainer.innerHTML = `<img src="data:image/jpeg;base64,${payload.imageBase64}" style="max-width:100%; border-radius:8px;"/>`;
    }
  });

  socket.on('iot-model-result', (payload) => {
    console.log('Received iot-model-result', payload);
    if (resultContainer) {
      resultContainer.textContent = JSON.stringify(payload, null, 2);
    }
  });
}

async function requestCapture() {
  try {
    const res = await fetch('https://e-waste-backend-3qxc.onrender.com/api/iot/capture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    const data = await res.json();
    console.log('capture requested', data);
    alert('Capture requested — waiting for device to respond.');
  } catch (err) {
    console.error('capture request failed', err);
    alert('Capture request failed: ' + err.message);
  }
}

async function requestRunModel() {
  try {
    const res = await fetch('https://e-waste-backend-3qxc.onrender.com/api/iot/run-model', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    const data = await res.json();
    console.log('run-model requested', data);
    alert('Run model requested — waiting for device to respond.');
  } catch (err) {
    console.error('run model request failed', err);
    alert('Run model request failed: ' + err.message);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupUi);
else setupUi();

export { requestCapture, requestRunModel, socket };
