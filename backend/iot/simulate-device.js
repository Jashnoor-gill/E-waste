// simulate-device.js
// Quick script to simulate an IoT device registering with the backend via socket.io
// Usage: node simulate-device.js

import { io } from 'socket.io-client';

const BACKEND = process.env.BACKEND_URL || 'http://localhost:5000';
const NAME = process.env.DEVICE_NAME || 'simulated-device';

const socket = io(BACKEND, { transports: ['websocket'], forceNew: true });

socket.on('connect', () => {
  console.log('Connected as device', socket.id, 'to', BACKEND);
  socket.emit('register_device', { name: NAME });
});

socket.on('register_success', (d) => console.log('register_success', d));
socket.on('register_error', (d) => console.warn('register_error', d));
socket.on('disconnect', () => console.log('disconnected'));

// keep process alive
process.stdin.resume();
