import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { loadTokens } from '../utils/deviceTokens.js';

const router = express.Router();
router.use(cors());
router.use(express.json({ limit: '60mb' })); // allow larger frames if needed

// In-memory store for latest frame per device:
// deviceId -> { frame: '<base64>', ts: 12345, filepath?: '/tmp/..' }
const frames = new Map();

// SSE clients for real-time streaming: deviceId -> Set(res)
const sseClients = new Map();

function verifyDeviceToken(req) {
  // If there are no tokens configured, accept by default (dev mode).
  const tokens = loadTokens();
  if (!tokens || tokens.length === 0) return true;
  const header = req.headers['x-device-token'];
  if (!header) return false;
  return tokens.includes(String(header));
}

router.get('/health', (req, res) => res.json({ ok: true }));

// POST /upload_frame
// body: { device_id: 'raspi-1', frame: '<base64-jpeg-or-png>' }
router.post('/upload_frame', (req, res) => {
  try {
    if (!verifyDeviceToken(req)) return res.status(403).json({ error: 'missing_or_invalid_device_token' });
    const { device_id, frame } = req.body || {};
    if (!device_id) return res.status(400).json({ error: 'device_id_required' });
    if (!frame) return res.status(400).json({ error: 'frame_required' });

    const ts = Date.now();
    const entry = { frame, ts };

    // Optionally save to disk for debugging / later processing
    if ((process.env.SAVE_FRAMES || '').toLowerCase() === 'true') {
      try {
        const buf = Buffer.from(frame, 'base64');
        const filename = `${device_id}-${ts}.jpg`;
        const dir = path.join(os.tmpdir(), 'ew-frames');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const filepath = path.join(dir, filename);
        fs.writeFileSync(filepath, buf);
        entry.filepath = filepath;
      } catch (err) {
        console.warn('Failed to save frame to disk', err.message);
      }
    }

    frames.set(device_id, entry);

    // notify SSE clients listening for this device
    const set = sseClients.get(device_id);
    if (set && set.size) {
      const payload = JSON.stringify({ device_id, ts, has_file: !!entry.filepath });
      for (const res of set) {
        try {
          res.write(`data: ${payload}\n\n`);
        } catch (e) { /* ignore */ }
      }
    }

    console.log(`Frame received from ${device_id} (size ~${String(frame).length} chars)`);
    return res.json({ status: 'ok', ts });
  } catch (err) {
    console.error('upload_frame error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// GET /latest_frame?device_id=raspi-1
router.get('/latest_frame', (req, res) => {
  const deviceId = req.query.device_id;
  if (!deviceId) return res.status(400).json({ error: 'device_id_required' });
  const entry = frames.get(deviceId);
  if (!entry) return res.status(404).json({ error: 'not_found' });
  return res.json({ device_id: deviceId, ts: entry.ts, frame: entry.frame, filepath: entry.filepath });
});

// GET /devices -> list known device ids
router.get('/devices', (req, res) => {
  return res.json(Array.from(frames.keys()));
});

// SSE endpoint: clients can connect to receive notice when a new frame arrives for a device
// GET /stream/:deviceId
router.get('/stream/:deviceId', (req, res) => {
  const deviceId = req.params.deviceId;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();

  const set = sseClients.get(deviceId) || new Set();
  set.add(res);
  sseClients.set(deviceId, set);

  req.on('close', () => {
    set.delete(res);
    if (set.size === 0) sseClients.delete(deviceId);
  });
});

export default router;
