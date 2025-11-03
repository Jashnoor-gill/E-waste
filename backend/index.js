
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

app.set('io', io);
app.set('devices', devices);

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
      devices.set(name, socket.id);
      console.log('Device registered:', name, socket.id);
      // notify admin clients
      io.emit('device-registered', { name, socketId: socket.id });
    } catch (err) {
      console.error('register_device error', err);
    }
  });

  // Relay photo events from device to all connected clients
  socket.on('iot-photo', (payload) => {
    io.emit('iot-photo', payload);
  });

  socket.on('iot-model-result', (payload) => {
    io.emit('iot-model-result', payload);
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
