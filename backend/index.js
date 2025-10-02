
import express from 'express';
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

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.use('/api/users', userRoutes);
app.use('/api/bins', binRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/stats', statRoutes);
app.use('/api/notify', notifyRoutes);

app.get('/', (req, res) => {
  res.send('E-Waste Management & Recycling API');
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);
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
