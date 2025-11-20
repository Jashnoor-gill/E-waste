
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import userRoutes from './routes/user.js';
import binRoutes from './routes/bin.js';
import eventRoutes from './routes/event.js';
import statRoutes from './routes/stat.js';
import notifyRoutes from './routes/notify.js';
import Bin from './models/Bin.js';

dotenv.config();

// Early process-level handlers and startup logging so hosting platforms
// (Render, etc.) surface binding or boot errors in logs before the app
// proceeds to create servers. Placing these handlers early helps capture
// errors that occur during module initialization.
process.on('uncaughtException', (err) => {
  console.error('Early uncaught exception:', err && err.stack ? err.stack : err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Early unhandled rejection:', reason && reason.stack ? reason.stack : reason);
});

console.log('Starting backend process', {
  NODE_ENV: process.env.NODE_ENV || null,
  PORT: process.env.PORT || null,
  MODEL_SERVICE_URL: process.env.MODEL_SERVICE_URL || null,
});

const app = express();
const server = http.createServer(app);
// Increase `maxHttpBufferSize` so large base64 image payloads emitted by
// devices (via socket.emit) do not cause the engine to drop the connection.
// Default is ~1MB which is too small for full-size images encoded as base64.
// Make this configurable via env var `SOCKET_MAX_HTTP_BUFFER_BYTES` (bytes).
const DEFAULT_MAX_BUFFER = parseInt(process.env.SOCKET_MAX_HTTP_BUFFER_BYTES || String(50 * 1024 * 1024), 10);
const io = new Server(server, { cors: { origin: '*' }, maxHttpBufferSize: DEFAULT_MAX_BUFFER });

// Device registry for connected IoT devices (key: deviceName, value: socketId)
const devices = new Map();
// Map requestId => { replySocketId }
const requestMap = new Map();
// Map deviceId -> latest model result { ts, payload }
const modelResults = new Map();

app.set('io', io);
app.set('devices', devices);
app.set('requestMap', requestMap);
app.set('modelResults', modelResults);

app.use(cors());
// Increase JSON body size limit to allow larger base64 image uploads from the frontend.
// Adjust as needed for your environment (e.g. '5mb', '10mb').
app.use(express.json({ limit: process.env.EXPRESS_JSON_LIMIT || '10mb' }));
app.use(express.urlencoded({ limit: process.env.EXPRESS_JSON_LIMIT || '10mb', extended: true }));

// Serve frontend statically so dashboard works over HTTP
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.join(__dirname, '../frontend');
app.use(express.static(frontendDir));

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

// Normalize MODEL_SERVICE_URL for logging and quick health check (helps troubleshooting)
function normalizeModelServiceUrl(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  try {
    if (!/\/infer($|\?|#|\/)/.test(s)) return s.replace(/\/$/, '');
    return s.replace(/\/$/, '');
  } catch (e) { return s; }
}
// Default to the deployed model service if env var not provided so the
// main backend forwards model requests to the running model_service.
const RAW_MODEL_SERVICE = process.env.MODEL_SERVICE_URL || 'https://e-waste-1-agt0.onrender.com/infer';
const MODEL_SERVICE_NORMALIZED = normalizeModelServiceUrl(RAW_MODEL_SERVICE);
// store last model service health check result on app for debug endpoint
app.set('modelServiceHealth', null);

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('⚠️  Server will continue running, but database features will not work.');
    console.log('💡 Check your MongoDB connection string in .env file');
  });

app.use('/api/users', userRoutes);
app.use('/api/bins', binRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/stats', statRoutes);
app.use('/api/notify', notifyRoutes);
import iotRoutes from './iot/iot.js';
import runModelRouter from './iot/run_model.js';
app.use('/api/iot', runModelRouter);
app.use('/api/iot', iotRoutes);
import frameRouter, { attachFrames } from './iot/frame_server.js';
app.use('/api/frame', frameRouter);
// expose the in-memory frames map from the frame router to the app so
// other modules (socket handlers) can update/read the latest frames.
try { attachFrames(app); } catch (e) { /* ignore */ }
import modelResultsRouter from './iot/model_results.js';
app.use('/api/iot', modelResultsRouter);
import authRoutes from './routes/auth.js';
app.use('/api/auth', authRoutes);
import deviceMgmt from './routes/device_mgmt.js';
app.use('/api/device-mgmt', deviceMgmt);
import modelUpload from './routes/model_upload.js';
app.use('/api/model', modelUpload);

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // Device registers itself with a name, e.g. { name: 'raspi-1' }
  socket.on('register_device', async (data) => {
    try {
      const name = (data && data.name) || `device-${socket.id}`;
      // optional token validation
      const token = data && data.token;
      // check persisted device tokens manager first
      const deviceTokensManager = await (async () => {
        try { const mod = await import('./utils/deviceTokens.js'); return mod; } catch (e) { return null; }
      })();
      let allowed = [];
      try {
        if (deviceTokensManager && deviceTokensManager.listTokens) allowed = deviceTokensManager.listTokens();
      } catch (e) { allowed = []; }
      // fallback to env if manager empty
      if (!allowed || allowed.length === 0) {
        allowed = (process.env.DEVICE_TOKENS || process.env.DEVICE_TOKEN || '').split(',').map(s=>s.trim()).filter(Boolean);
      }
      if (allowed.length > 0 && !allowed.includes(token)) {
        console.warn('Device failed auth', name);
        socket.emit('register_error', { error: 'invalid_token' });
        return;
      }
  devices.set(name, socket.id);
  console.log('Device registered:', name, socket.id);
  // notify admin clients
  io.emit('device-registered', { name, socketId: socket.id });
  // let device know registration succeeded
  try { socket.emit('register_success', { name }); } catch (e) { /* ignore */ }
    } catch (err) {
      console.error('register_device error', err);
    }
  });

  // Relay photo events from device -> only to requester (if mapped)
  socket.on('iot-photo', (payload) => {
    try {
      // Log approximate size for debugging large payload disconnects
      try {
        const size = payload && (payload.image_b64 ? String(payload.image_b64).length : (payload.frame ? String(payload.frame).length : null));
        console.log('iot-photo received. approx payload size chars:', size);
      } catch (e) { /* ignore logging errors */ }
    } catch (e) {}
    try {
      const rid = payload && payload.requestId;
      if (rid && requestMap.has(rid)) {
        const mapping = requestMap.get(rid) || {};
        const dest = mapping.replySocketId;
        // clear any outstanding timeout associated with this request
        try { if (mapping.timeoutId) clearTimeout(mapping.timeoutId); } catch (e) {}
        if (dest) io.to(dest).emit('iot-photo', payload);
        // cleanup mapping
        requestMap.delete(rid);
        return;
      }
      // fallback: broadcast
      io.emit('iot-photo', payload);
      // If the device sent a base64 frame (image), persist it in the in-memory
      // frames map so the `/api/frame/latest_frame` endpoint can return it.
      try {
        const framesMap = app.get('frames');
        // payload may include different keys: `frame`, `image_b64` or `photo`
        const device = payload && (payload.device || payload.device_id || payload.deviceId || payload.name || null);
        const frameB64 = payload && (payload.frame || payload.image_b64 || payload.photo || null);
        if (device && frameB64 && framesMap) {
          framesMap.set(device, { frame: frameB64, ts: Date.now() });
        }
      } catch (e) { /* non-fatal */ }
    } catch (err) { console.error('iot-photo relay error', err); }
  });

  socket.on('iot-model-result', (payload) => {
    try {
      const rid = payload && payload.requestId;
      if (rid && requestMap.has(rid)) {
        const mapping = requestMap.get(rid) || {};
        const dest = mapping.replySocketId;
        // clear timeout for this request
        try { if (mapping.timeoutId) clearTimeout(mapping.timeoutId); } catch (e) {}
        if (dest) io.to(dest).emit('iot-model-result', payload);
        requestMap.delete(rid);
        return;
      }
      io.emit('iot-model-result', payload);
      // Persist latest model result per device so clients can fetch it later
      try {
        const device = payload && (payload.device || payload.device_id || payload.deviceId || null);
        if (device) {
          const entry = { ts: Date.now(), payload };
          modelResults.set(device, entry);
        }
      } catch (e) { /* ignore persistence errors */ }
    } catch (err) { console.error('iot-model-result relay error', err); }
  });

  socket.on('disconnect', () => {
    // remove device(s) matching this socket id
    for (const [name, id] of devices.entries()) {
      if (id === socket.id) {
        devices.delete(name);
        console.log('Device disconnected:', name);
        io.emit('device-disconnected', { name });
      }
    }
  });
});

// Example: emit bin status update on bin update
app.put('/api/bins/:id', async (req, res) => {
  const bin = await Bin.findByIdAndUpdate(req.params.id, req.body, { new: true });
  io.emit('binStatusUpdate', bin);
  res.json(bin);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} (bound to 0.0.0.0)`);
  // Log model service URL info for easier debugging
  try {
    if (MODEL_SERVICE_NORMALIZED) console.log(`Model service (normalized): ${MODEL_SERVICE_NORMALIZED}`);
    else console.log('MODEL_SERVICE_URL not set');
  } catch (e) { /* ignore */ }

  // Optionally probe model service health (best-effort). Uses global fetch if available.
  (async () => {
    if (!MODEL_SERVICE_NORMALIZED) return;
    const healthUrl = MODEL_SERVICE_NORMALIZED.replace(/\/infer($|\/)/, '') + '/health';
    try {
      let fetchFn = (typeof fetch !== 'undefined') ? fetch : null;
      if (!fetchFn) {
        const mod = await import('node-fetch');
        fetchFn = mod.default;
      }
      const res = await fetchFn(healthUrl, { method: 'GET', timeout: 5000 });
      try { const j = await res.json(); console.log('Model service health:', j); app.set('modelServiceHealth', { ok: true, payload: j, ts: Date.now() }); }
      catch (e) { const txt = await res.text().catch(()=>'<unreadable>'); console.log('Model service health non-JSON response:', txt); app.set('modelServiceHealth', { ok: false, payload: txt, ts: Date.now() }); }
    } catch (err) {
      console.warn('Model service health check failed:', String(err).slice(0,200));
      app.set('modelServiceHealth', { ok: false, error: String(err), ts: Date.now() });
    }
  })();
});

// Log server errors (useful in hosting environments that may prevent binding)
server.on('error', (err) => {
  console.error('Server error:', err && err.stack ? err.stack : err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err && err.stack ? err.stack : err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason && reason.stack ? reason.stack : reason);
});

// Debug endpoint: return normalized model service URL and last health-check result (no secrets)
app.get('/debug/model-target', (req, res) => {
  try {
    const info = { model_service_normalized: MODEL_SERVICE_NORMALIZED || null, health: app.get('modelServiceHealth') || null };
    return res.json(info);
  } catch (e) {
    return res.status(500).json({ error: 'failed to read model target info' });
  }
});

// Debug: list registered IoT devices (name -> socketId). Read-only, no secrets returned.
app.get('/debug/devices', (req, res) => {
  try {
    const devicesMap = app.get('devices');
    if (!devicesMap) return res.json({ devices: [] });
    const devices = [];
    for (const [name, socketId] of devicesMap.entries()) devices.push({ name, socketId });
    return res.json({ devices, count: devices.length });
  } catch (e) {
    return res.status(500).json({ error: 'failed to list devices' });
  }
});
