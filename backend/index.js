
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

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Device registry for connected IoT devices (key: deviceName, value: socketId)
const devices = new Map();
// Map requestId => { replySocketId }
const requestMap = new Map();

app.set('io', io);
app.set('devices', devices);
app.set('requestMap', requestMap);

app.use(cors());
app.use(express.json());

// Serve frontend statically so dashboard works over HTTP
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.join(__dirname, '../frontend');
app.use(express.static(frontendDir));

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

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
import iotRoutes from './routes/iot.js';
app.use('/api/iot', iotRoutes);
import deviceMgmt from './routes/device_mgmt.js';
app.use('/api/device-mgmt', deviceMgmt);
import iotMock from './routes/iot_mock.js';
app.use('/api/iot/mock', iotMock);
import modelUpload from './routes/model_upload.js';
app.use('/api/model', modelUpload);

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // Device registers itself with a name, e.g. { name: 'raspi-1' }
  socket.on('register_device', (data) => {
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
      const rid = payload && payload.requestId;
      if (rid && requestMap.has(rid)) {
        const dest = requestMap.get(rid).replySocketId;
        if (dest) io.to(dest).emit('iot-photo', payload);
        // cleanup mapping
        requestMap.delete(rid);
        return;
      }
      // fallback: broadcast
      io.emit('iot-photo', payload);
    } catch (err) { console.error('iot-photo relay error', err); }
  });

  socket.on('iot-model-result', (payload) => {
    try {
      const rid = payload && payload.requestId;
      if (rid && requestMap.has(rid)) {
        const dest = requestMap.get(rid).replySocketId;
        if (dest) io.to(dest).emit('iot-model-result', payload);
        requestMap.delete(rid);
        return;
      }
      io.emit('iot-model-result', payload);
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

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
