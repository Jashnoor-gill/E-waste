import express from 'express';
import Event from '../models/Event.js';
import Stat from '../models/Stat.js';
import { loadTokens } from '../utils/deviceTokens.js';

const router = express.Router();

// GET /latest_model_result?device_id=raspi-1
router.get('/latest_model_result', (req, res) => {
  try {
    const deviceId = req.query.device_id || req.query.deviceId || req.query.device;
    if (!deviceId) return res.status(400).json({ error: 'device_id required' });
    const modelResults = req.app.get('modelResults');
    if (!modelResults) return res.status(500).json({ error: 'model results not configured' });
    const entry = modelResults.get(deviceId);
    if (!entry) return res.status(404).json({ error: 'not_found' });
    return res.json({ device_id: deviceId, ts: entry.ts, result: entry.payload });
  } catch (err) {
    console.error('latest_model_result error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// POST /model_result
// Body: { device_id: 'raspi-1', result: { label, confidence, weight, category, ... } }
router.post('/model_result', async (req, res) => {
  try {
    // simple device token verification (same approach as frame_server)
    const tokens = loadTokens();
    if (tokens && tokens.length > 0) {
      const header = req.headers['x-device-token'];
      if (!header || !tokens.includes(String(header))) return res.status(403).json({ error: 'missing_or_invalid_device_token' });
    }

    const body = req.body || {};
    const deviceId = body.device_id || body.device || body.deviceId;
    const result = body.result || body;
    if (!deviceId || !result) return res.status(400).json({ error: 'device_id_and_result_required' });

    // persist latest model result in memory for quick retrieval by clients
    const modelResults = req.app.get('modelResults');
    if (modelResults) modelResults.set(String(deviceId), { ts: Date.now(), payload: result });

    // Emit the model result to connected clients via socket.io so the web UI updates in real-time
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('iot-model-result', { device_id: deviceId, result });
      }
    } catch (e) {
      console.warn('Failed to emit iot-model-result via socket.io', e);
    }

    // If result contains a weight/amount, create a deposit event and update stats
    const weight = (result.weight !== undefined) ? Number(result.weight) : (result.amount !== undefined ? Number(result.amount) : null);
    const label = result.label || result.category || 'unknown';
    let createdEvent = null;
    if (weight && !Number.isNaN(weight) && weight > 0) {
      try {
        const ev = new Event({ type: 'deposit', amount: weight, category: label, details: `Auto deposit from device ${deviceId}` });
        await ev.save();
        createdEvent = ev;
        // Update global stats: increment totalEwaste and co2Saved
        const co2Increment = weight * 2.5; // 2.5 kg CO2 per kg e-waste (same factor used in frontend)
        await Stat.findOneAndUpdate({}, { $inc: { totalEwaste: weight, co2Saved: co2Increment } }, { upsert: true });
      } catch (e) {
        console.warn('Failed to create event or update stats from model_result', e);
      }
    }

    return res.json({ ok: true, device_id: deviceId, result, event: createdEvent ? createdEvent._id : null });
  } catch (err) {
    console.error('model_result POST error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

export default router;
