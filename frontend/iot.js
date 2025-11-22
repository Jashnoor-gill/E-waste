import { io as ioClient } from 'https://cdn.socket.io/4.7.5/socket.io.esm.min.js';
import { getMockEnabled, setMockEnabled, getBins, getStats, getDepositSeries } from './api.js';

// Connect to backend socket.io. Use the current page origin so local dev points to local backend
const DEFAULT_BACKEND = 'https://e-waste-backend-3qxc.onrender.com';
// Allow an explicit runtime-configured backend (useful when frontend is hosted on Netlify)
// You can create a small `config.js` that sets `window.BACKEND_URL = 'https://your-backend.onrender.com'`
const ORIGIN = (typeof window !== 'undefined' && window.BACKEND_URL) ? window.BACKEND_URL : ((typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null') ? window.location.origin : DEFAULT_BACKEND);
const SOCKET_URL = ORIGIN;
const socket = ioClient(SOCKET_URL);

// Expose to window for quick debugging
window.iotSocket = socket;
// Client-side model (optional): lazy-load TensorFlow.js + MobileNet for on-page predictions
// Local in-browser model and webcam capture removed: device (Pi) is the primary
// source for captures and inference. Server-side model calls remain available
// via backend endpoints and the Pi/device flow.
// If set to true (or '1'/'true') in a site-level config, the frontend will
// completely disable use of the local laptop webcam and only use Pi feeds.
// Allow an override via localStorage `ENABLE_LOCAL_WEBCAM` so users can toggle
// local webcam at runtime (stored as 'true'|'false'). Default keeps local
// webcam disabled for deployed sites unless explicitly enabled.
const DISABLE_LOCAL_WEBCAM = (function(){
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('ENABLE_LOCAL_WEBCAM');
      if (stored !== null) return !(stored === 'true');
      return (window.DISABLE_LOCAL_WEBCAM === true || window.DISABLE_LOCAL_WEBCAM === '1' || window.DISABLE_LOCAL_WEBCAM === 'true');
    }
  } catch (e) { /* ignore localStorage errors */ }
  return true;
})();

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
  const checkFillBtn = document.getElementById('checkFillBtn');
  const binLevelResult = document.getElementById('binLevelResult');
  const mockMetrics = document.getElementById('mockMetrics');
  const depositCanvas = document.getElementById('depositChart');
  const mockToggleBtn = document.getElementById('mockToggleBtn');

  if (captureBtn) captureBtn.addEventListener('click', requestCapture);
  if (runBtn) runBtn.addEventListener('click', requestRunModel);
  if (DISABLE_LOCAL_WEBCAM) {
    // Hide/disable all local webcam controls when local webcam is disabled
    [webcamStartBtn, webcamStopBtn, webcamCaptureBtn, webcamOneClickBtn].forEach(b => { if (b) { b.style.display = 'none'; b.disabled = true; } });
    // Hide local video element if present
    try { const v = document.getElementById('webcamVideo'); if (v) v.style.display = 'none'; } catch(e){}
  }
  // Local browser webcam support removed; captures come from the Pi device.
  if (startPiFeedBtn) startPiFeedBtn.addEventListener('click', () => startPiFeed());
  if (stopPiFeedBtn) stopPiFeedBtn.addEventListener('click', () => stopPiFeed());
  if (startPiCameraBtn) startPiCameraBtn.addEventListener('click', () => startPiCamera());
  if (stopPiCameraBtn) stopPiCameraBtn.addEventListener('click', () => stopPiCamera());
  if (checkFillBtn) checkFillBtn.addEventListener('click', async () => {
    try {
      const id = (piDeviceIdInput && piDeviceIdInput.value) ? piDeviceIdInput.value.trim() : '';
      if (!id) {
        alert('Please enter a Device ID or Bin identifier first');
        return;
      }
      // If mock enabled, keep existing mock behavior
      if (typeof getMockEnabled === 'function' && getMockEnabled()) {
        try {
          if (binLevelResult) binLevelResult.innerHTML = '<div class="card" style="padding:0.75rem">Checking fill level (mock)...</div>';
          const bins = await getBins();
          const b = bins.find(x => (x.id && x.id === id) || (x._id && x._id === id) || (x.qrCode && x.qrCode === id));
          if (!b) {
            if (binLevelResult) binLevelResult.innerHTML = `<div class="card" style="padding:0.75rem; color:#c62828">Mock: Bin not found: ${id}</div>`;
            return;
          }
          // Reuse existing mock flow to compute level
          let levelVal = null;
          if (typeof b.fillKg === 'number' && typeof b.capacityKg === 'number' && b.capacityKg > 0) levelVal = (b.fillKg / b.capacityKg) * 100.0;
          else if (typeof b.level === 'number') levelVal = b.level;
          else levelVal = Math.round((Math.random() * 60 + 10) * 10) / 10;
          const empty = (b.empty_distance_cm && typeof b.empty_distance_cm === 'number') ? b.empty_distance_cm : 80.0;
          const full = (b.full_distance_cm && typeof b.full_distance_cm === 'number') ? b.full_distance_cm : 10.0;
          const dist = Math.max(full, Math.min(empty, empty - (levelVal/100.0) * (empty - full)));
          const levelStr = `${Number(levelVal).toFixed(1)}%`;
          const distStr = `${Number(dist).toFixed(1)} cm`;
          const status = (levelVal >= 95) ? 'full' : (levelVal >= 70 ? 'collecting' : 'available');
          const updated = new Date().toLocaleString();
          if (binLevelResult) binLevelResult.innerHTML = `
            <div class="card" style="padding:0.75rem">
              <div><strong>Bin:</strong> ${b.id || b._id || id}</div>
              <div><strong>Level:</strong> ${levelStr}</div>
              <div><strong>Distance:</strong> ${distStr}</div>
              <div><strong>Status:</strong> ${status}</div>
              <div style="font-size:0.85rem; color:#666"><strong>Updated:</strong> ${updated} (mock)</div>
            </div>
          `;
          return;
        } catch (e) {
          console.warn('Mock checkFill failed', e);
          if (binLevelResult) binLevelResult.innerHTML = `<div class="card" style="padding:0.75rem; color:#c62828">Mock request failed: ${String(e)}</div>`;
          return;
        }
      }

      // Non-mock mode: hardcode ultrasonic output to 0% fill level as requested
      const levelVal = 0.0;
      const levelStr = `${Number(levelVal).toFixed(1)}%`;
      const distStr = `80.0 cm`;
      const status = 'available';
      const updated = new Date().toLocaleString();
      if (binLevelResult) binLevelResult.innerHTML = `
        <div class="card" style="padding:0.75rem">
          <div><strong>Bin:</strong> ${id}</div>
          <div><strong>Level:</strong> ${levelStr}</div>
          <div><strong>Distance:</strong> ${distStr}</div>
          <div><strong>Status:</strong> ${status}</div>
          <div style="font-size:0.85rem; color:#666"><strong>Updated:</strong> ${updated}</div>
        </div>
      `;
    } catch (e) {
      console.warn('checkFillBtn handler error', e);
      if (binLevelResult) binLevelResult.innerHTML = `<div class="card" style="padding:0.75rem; color:#c62828">Request failed: ${String(e)}</div>`;
    }
  });

  // If mock mode is enabled, render mock metrics and deposit-over-time chart
  async function renderMockMetricsIfNeeded() {
    try {
      if (!(typeof getMockEnabled === 'function' && getMockEnabled())) return;
      if (!mockMetrics && !depositCanvas) return;
      // Load mock stats and deposit series
      const [stats, series] = await Promise.all([ (typeof getStats === 'function' ? getStats() : Promise.resolve({})), (typeof getDepositSeries === 'function' ? getDepositSeries() : Promise.resolve({ labels: [], data: [] })) ]);
      if (mockMetrics) {
        const html = `
          <div class="card" style="padding:0.75rem">
            <div><strong>Points:</strong> ${stats.pointsEarned ?? 'N/A'}</div>
            <div><strong>Level (global):</strong> ${stats.totalEwasteKg ? stats.totalEwasteKg.toFixed(1) + ' kg' : 'N/A'}</div>
            <div><strong>CO₂ Saved:</strong> ${stats.co2SavedKg ?? 'N/A'} kg</div>
            <div><strong>Energy Saved:</strong> ${stats.energySavedKWh ?? 'N/A'} kWh</div>
          </div>`;
        mockMetrics.innerHTML = html;
      }
      if (depositCanvas && window.Chart && series && Array.isArray(series.labels)) {
        try {
          // destroy previous chart if any
          if (depositCanvas._chart) depositCanvas._chart.destroy();
          const ctx = depositCanvas.getContext('2d');
          depositCanvas._chart = new Chart(ctx, {
            type: 'line',
            data: {
              labels: series.labels,
              datasets: [{ label: 'Deposits (kg)', data: series.data, borderColor: '#1a7f37', backgroundColor: 'rgba(26,127,55,0.08)', fill: true }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { x: { display: true }, y: { beginAtZero: true } } }
          });
        } catch (e) { console.warn('Failed to render deposit chart', e); }
      }
    } catch (e) { /* ignore */ }
  }
  // Kick off rendering when UI is ready
  try { renderMockMetricsIfNeeded(); } catch (e) {}
  if (mockToggleBtn) {
    // initialize mock state from localStorage (if present) or from api.getMockEnabled
    try {
      let enabled = true;
      const stored = localStorage.getItem('ENABLE_MOCK');
      if (stored !== null) enabled = stored === 'true';
      else enabled = getMockEnabled();
      setMockEnabled(enabled);
    } catch (e) { try { setMockEnabled(getMockEnabled()); } catch(e){ } }

    const updateMockToggleUI = () => {
      try {
        const on = !!getMockEnabled();
        mockToggleBtn.textContent = on ? 'Mock: On' : 'Mock: Off';
        mockToggleBtn.style.background = on ? '#e8f5e9' : '#fff3e0';
        mockToggleBtn.style.borderColor = on ? '#c8e6c9' : '#ffecb3';
      } catch (e) { /* ignore */ }
    };

    mockToggleBtn.addEventListener('click', (ev) => {
      try {
        const cur = !!getMockEnabled();
        const next = !cur;
        setMockEnabled(next);
        try { localStorage.setItem('ENABLE_MOCK', next ? 'true' : 'false'); } catch (e) {}
        updateMockToggleUI();
      } catch (e) { console.warn('mock toggle failed', e); }
    });
    // reflect initial state
    try { updateMockToggleUI(); } catch (e) {}
  }
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
  // Test camera button removed or inert when using device-only captures.

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
      // Basic validation: try to detect common image formats by magic bytes (JPEG or PNG)
      let mime = null;
      try {
        // decode a small sample and inspect for JPEG/PNG or SVG (text)
        const sample = atob(imgB64.slice(0, 80));
        const b0 = sample.charCodeAt(0);
        const b1 = sample.charCodeAt(1);
        const b2 = sample.charCodeAt(2);
        const b3 = sample.charCodeAt(3);
        // JPEG magic bytes: 0xFF 0xD8
        if (b0 === 0xFF && b1 === 0xD8) mime = 'image/jpeg';
        // PNG magic bytes: 0x89 0x50 0x4E 0x47
        else if (b0 === 0x89 && b1 === 0x50 && b2 === 0x4E && b3 === 0x47) mime = 'image/png';
        // SVG (text) typically starts with '<'
        else if (sample && sample.length > 0 && sample[0] === '<') mime = 'image/svg+xml';
      } catch (e) { mime = null; }
      if (!mime) {
        console.warn('Received iot-photo but payload does not look like a supported image; showing raw payload for debugging', payload);
        imgContainer.innerHTML = `<div class="card" style="padding:1rem; color:#c62828">Received non-image payload (size ${imgB64.length} chars). Check device capture code.</div>`;
      } else {
        // Debug: log prefix and chosen mime to investigate load failures
        try { console.log('iot-photo -> setting capture image mime=', mime, 'prefix=', (imgB64||'').slice(0,8)); } catch(e){}
        imgContainer.innerHTML = `<img src="data:${mime};base64,${imgB64}" style="width:100%; max-width:640px; height:auto; border-radius:8px;"/>`;
        // If device id is provided, persist the received frame to the frame server
        try {
          const deviceId = payload.device || payload.device_id || (document.getElementById('piDeviceIdInput') && document.getElementById('piDeviceIdInput').value) || 'raspi-1';
          console.log('persistFrameToServer: device=', deviceId, 'frameLen=', imgB64.length);
          persistFrameToServer(deviceId, imgB64).catch((e) => console.warn('persistFrameToServer failed', e));
        } catch (e) { /* ignore */ }
      }
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
      // If in mock mode, store the latest frame locally and skip network
      if (getMockEnabled && getMockEnabled()) {
        try { localStorage.setItem(`mock_latest_frame_${deviceId}`, base64Frame); } catch (e) {}
        return;
      }
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
  // Expose frame persisting to top-level so other functions (webcam capture, run model) can reuse it
  try { window.persistFrameToServer = persistFrameToServer; } catch (e) { /* ignore */ }

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
      // If mock mode is enabled, read the latest mock frame from localStorage
      if (getMockEnabled && getMockEnabled()) {
        try {
          const key = `mock_latest_frame_${deviceId}`;
          const b64 = localStorage.getItem(key);
          const img = document.getElementById('remoteFrameImg');
          if (!img) return;
          if (b64) {
            // Detect common base64 prefixes to identify type without decoding partial chunks.
            // SVGs encoded from '<svg' typically start with 'PHN2' (base64 for '<svg').
            // XML prolog '<?xml' starts with 'PD94'. JPEG base64 often starts with '/9j/'. PNG starts with 'iVBOR'.
            const prefix = (b64 || '').slice(0, 8);
            let chosen;
            if (prefix.startsWith('PHN2') || prefix.startsWith('PD94')) { chosen = 'image/svg+xml'; img.src = 'data:image/svg+xml;base64,' + b64; }
            else if (prefix.startsWith('iVBOR')) { chosen = 'image/png'; img.src = 'data:image/png;base64,' + b64; }
            else if (prefix.startsWith('/9j') || prefix.startsWith('/9j/')) { chosen = 'image/jpeg'; img.src = 'data:image/jpeg;base64,' + b64; }
            else { chosen = 'image/jpeg'; img.src = 'data:image/jpeg;base64,' + b64; }
            try { console.log('mock fetchAndUpdatePiFrame -> set remoteFrameImg mime=', chosen, 'prefix=', prefix); } catch(e){}
            img.style.display = 'block';
          } else {
            img.style.display = 'none';
          }
        } catch (e) { console.warn('mock fetchAndUpdatePiFrame failed', e); }
        return;
      }

      const res = await fetch(`${ORIGIN.replace(/\/$/, '')}/api/frame/latest_frame?device_id=${encodeURIComponent(deviceId)}`);
      if (!res.ok) {
        // If no frame found (404), do not automatically show a placeholder image here.
        // Showing a placeholder on feed start was noisy; keep the remote frame hidden
        // until an actual frame is available (the placeholder card is shown via
        // other UI flows when appropriate).
        if (res.status === 404) {
          const img = document.getElementById('remoteFrameImg');
          if (img) {
            img.style.display = 'none';
          }
        }
        return;
      }
      const j = await res.json();
        if (j) {
          const img = document.getElementById('remoteFrameImg');
          if (!img) return;
          // If backend returned a presigned URL (S3), prefer that
          if (j.presignedUrl) {
            img.src = j.presignedUrl;
            img.style.display = 'block';
            try { console.log('fetchAndUpdatePiFrame -> set remoteFrameImg via presignedUrl', j.presignedUrl); } catch(e){}
            return;
          }
          // If backend returns a GridFS url (or generic `url`) prefer that
          if (j.url) {
            // If URL is relative, prefix with origin
            const u = (j.url.startsWith('http://') || j.url.startsWith('https://')) ? j.url : `${ORIGIN.replace(/\/$/, '')}${j.url}`;
            img.src = u;
            img.style.display = 'block';
            try { console.log('fetchAndUpdatePiFrame -> set remoteFrameImg via gridfs/url', u); } catch(e){}
            return;
          }
          if (j.frame) {
            // Detect common base64 prefixes to choose MIME safely without decoding.
            const p = (j.frame || '').slice(0, 8);
            let mime = 'image/jpeg';
            if (p.startsWith('PHN2') || p.startsWith('PD94')) mime = 'image/svg+xml';
            else if (p.startsWith('iVBOR')) mime = 'image/png';
            else if (p.startsWith('/9j') || p.startsWith('/9j/')) mime = 'image/jpeg';
            img.src = `data:${mime};base64,${j.frame}`;
            img.style.display = 'block';
            try { console.log('fetchAndUpdatePiFrame -> set remoteFrameImg mime=', mime, 'prefix=', p); } catch(e){}
          }
        }
    } catch (e) { console.warn('fetchAndUpdatePiFrame failed', e); }
  }

  function startPiFeed(deviceId) {
    deviceId = deviceId || ((piDeviceIdInput && piDeviceIdInput.value) ? piDeviceIdInput.value : 'raspi-1');
    // prefer SSE
    try {
      stopPiFeed();
      if (getMockEnabled && getMockEnabled()) {
        // In mock mode, poll localStorage for updates
        fetchAndUpdatePiFrame(deviceId);
        if (!_piPolling) _piPolling = setInterval(() => fetchAndUpdatePiFrame(deviceId), 2000);
      } else {
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
      }
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
      // In mock mode, check whether a locally stored mock frame exists
      if (getMockEnabled && getMockEnabled()) {
        try {
          const key = `mock_latest_frame_${deviceId}`;
          const b64 = localStorage.getItem(key);
          return !!b64;
        } catch (e) { return false; }
      }
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
        // start Pi feed
        startPiFeed(deviceId);
      } else {
        // fall back: DO NOT auto-start the local webcam here. The preferred UX is
        // to only start local camera when the user explicitly clicks Capture.
        if (DISABLE_LOCAL_WEBCAM) {
          try { alert('No Pi feed available and local webcam usage is disabled by site configuration.'); } catch(e) {}
          return;
        }
        try {
          alert('No Pi feed available. Click the Capture button to start the camera for a one-shot capture.');
        } catch (e) { /* ignore */ }
      }
    } catch (err) {
      console.warn('startPreferredCamera failed', err);
      // fallback removed: local webcam support disabled in this build
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

function renderModelResult(result) {
  const rc = document.getElementById('iotModelResult');
  if (!rc) return;
  // Accept both { requestId, result: { label, confidence } } and direct result
  const payload = result && result.result ? result.result : result || {};
  // If device or server returned an error, show a clear message
  if (payload.error || result && result.error) {
    const err = (payload.error || result.error || 'unknown_error');
    let msg = 'Model run failed';
    if (err === 'device_timeout') msg = 'Device did not respond (timeout). Please check the device.';
    else msg = `Error: ${err}`;
    rc.innerHTML = `<div class="card" style="padding:1rem; color:#c62828"><strong>${msg}</strong></div>`;
    return;
  }

  const label = payload.label || 'Unknown';
  const confidence = typeof payload.confidence === 'number' ? payload.confidence : (payload.conf ? payload.conf : 0);

  rc.innerHTML = `
    <div class="iot-result-card">
      <div class="iot-result-label">${label}</div>
      <div class="iot-result-confidence">Confidence: ${(confidence * 100).toFixed(1)}%</div>
      <div class="confidence-bar"><div class="confidence-fill" style="width:${Math.max(0, Math.min(100, confidence*100))}%"></div></div>
      <div class="iot-result-source">Source: ${payload.source || (result && result.source) || 'server'}</div>
    </div>
  `;
}

async function requestCapture() {
  try {
    // If mock mode enabled, simulate a device capture locally
    if (getMockEnabled && getMockEnabled()) {
      showCaptureLoading(true);
      // Create a simple SVG placeholder and base64-encode it
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='240'><rect width='100%' height='100%' fill='#e8f5e9'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#1a7f37' font-size='18'>Mock Camera\nraspi-1</text></svg>`;
      const b64 = btoa(svg);
      const payload = { image_b64: b64, device: (document.getElementById('piDeviceIdInput') && document.getElementById('piDeviceIdInput').value) || 'raspi-1' };
      // render similarly to incoming socket event
      try {
        const imgContainer = document.getElementById('iotImageContainer');
        if (imgContainer) imgContainer.innerHTML = `<img src="data:image/svg+xml;base64,${b64}" style="width:100%; max-width:640px; height:auto; border-radius:8px;"/>`;
        try { persistFrameToServer(payload.device, b64).catch(()=>{}); } catch(e){}
      } catch (e) { console.warn('mock capture render failed', e); }
      showCaptureLoading(false);
      _piCaptureInFlight = false;
      return;
    }
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
    // If mock enabled, synthesize a model result locally
    if (getMockEnabled && getMockEnabled()) {
      const cats = ['mobile','pcb','cable','charger','headphones'];
      const pick = cats[Math.floor(Math.random()*cats.length)];
      const confidence = Math.random() * 0.4 + 0.6; // 60-100%
      await new Promise(r => setTimeout(r, 600 + Math.floor(Math.random()*800)));
      renderModelResult({ label: pick, confidence, source: 'mock' });
      showModelLoading(false);
      return;
    }

    const runModelUrl = `${ORIGIN.replace(/\/$/, '')}/api/iot/run-model`;
    // Prefer device-side run; include optional device name if provided in UI
    const deviceName = (document.getElementById('piDeviceIdInput') && document.getElementById('piDeviceIdInput').value) ? document.getElementById('piDeviceIdInput').value : undefined;
    const body = { replySocketId: socket.id, ...(deviceName ? { deviceName } : {}) };

    const res = await fetch(runModelUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) {
      const txt = await res.text().catch(() => `Status ${res.status}`);
      throw new Error(`Server error ${res.status}: ${txt.slice(0,200)}`);
    }
    let data;
    try { data = await res.json(); }
    catch (e) { const txt = await res.text().catch(()=> 'Invalid JSON'); throw new Error('Invalid JSON response: '+txt.slice(0,200)); }
    console.log('run-model requested', data);
    try {
      if (data && data.result) renderModelResult(data.result);
      else if (data) renderModelResult(data);
    } catch (err) { console.warn('Failed to render model result', err); }
    showModelLoading(false);
  } catch (err) {
    console.error('run model request failed', err);
    alert('Run model request failed: ' + err.message);
    showModelLoading(false);
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
    if (getMockEnabled && getMockEnabled()) {
      try { const bins = await getBins(); return Array.isArray(bins); } catch (e) { return false; }
    }
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
