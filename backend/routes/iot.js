import express from 'express';
import { callModelServiceWithRetries as callModelService } from '../utils/modelClient.js';
const router = express.Router();

// Simple helper to create a request id
function makeReqId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
}

// Trigger a camera capture on the first connected device (or named device)
router.post('/capture', async (req, res) => {
  const io = req.app.get('io');
  const devices = req.app.get('devices');
  if (!io || !devices) return res.status(500).json({ error: 'IoT not configured' });

  // allow selecting device by name in body
  const deviceName = req.body && req.body.deviceName;
  let targetSocketId;
  if (deviceName && devices.has(deviceName)) targetSocketId = devices.get(deviceName);
  else {
    // pick first available device
    const first = devices.entries().next();
    if (!first.done) targetSocketId = first.value[1];
  }

  if (!targetSocketId) return res.status(503).json({ error: 'No IoT device connected' });

  const requestId = makeReqId();
  // map requestId -> reply socket id (if provided by caller)
  const replySocketId = req.body && req.body.replySocketId;
  const requestMap = req.app.get('requestMap');
  if (replySocketId && requestMap) requestMap.set(requestId, { replySocketId, ts: Date.now() });
  io.to(targetSocketId).emit('capture', { requestId, metadata: req.body && req.body.metadata });
  return res.status(202).json({ requestId, message: 'Capture requested' });
});

// Trigger running the ML model on device and optionally hardware actuators
router.post('/run-model', async (req, res) => {
  const io = req.app.get('io');
  const devices = req.app.get('devices');
  if (!io || !devices) return res.status(500).json({ error: 'IoT not configured' });
  // If caller provided an image (base64) we'll run inference on the server-side model service
  const MODEL_SERVICE_URL = process.env.MODEL_SERVICE_URL || 'http://localhost:8001/infer';
  const body = req.body || {};

  // If caller explicitly requests a mocked/demo result, return a canned response and forward to socket
  if (body.mock) {
    const requestId = makeReqId();
    const replySocketId = body.replySocketId;
    const requestMap = req.app.get('requestMap');
    if (replySocketId && requestMap) requestMap.set(requestId, { replySocketId, ts: Date.now() });

    const mocked = { label: 'Mobile', confidence: 0.87, note: 'demo (mock) result' };
    try {
      if (replySocketId) io.to(replySocketId).emit('iot-model-result', { requestId, ...mocked, source: 'mock' });
    } catch (e) { /* ignore socket errors */ }
    return res.status(200).json({ requestId, result: mocked });
  }

  // If image_b64 provided, call model service directly and return/forward result
  if (body.image_b64) {
    const requestId = makeReqId();
    const replySocketId = body.replySocketId;
    const requestMap = req.app.get('requestMap');
    if (replySocketId && requestMap) requestMap.set(requestId, { replySocketId, ts: Date.now() });

    try {
      const j = await callModelService(MODEL_SERVICE_URL, { image_b64: body.image_b64 });
      if (replySocketId) {
        io.to(replySocketId).emit('iot-model-result', { requestId, label: j.label, confidence: j.confidence, source: 'server' });
      }
      return res.status(200).json({ requestId, result: j });
    } catch (err) {
      console.error('Model service call failed', err);
      return res.status(500).json({ error: 'Model service call failed', details: String(err) });
    }
  }

  // Otherwise forward run_model to a device as before
  const deviceName = body.deviceName;
  let targetSocketId;
  if (deviceName && devices.has(deviceName)) targetSocketId = devices.get(deviceName);
  else {
    const first = devices.entries().next();
    if (!first.done) targetSocketId = first.value[1];
  }
  if (!targetSocketId) return res.status(503).json({ error: 'No IoT device connected' });

  const requestId = makeReqId();
  const replySocketId = body.replySocketId;
  const requestMap = req.app.get('requestMap');
  if (replySocketId && requestMap) requestMap.set(requestId, { replySocketId, ts: Date.now() });
  io.to(targetSocketId).emit('run_model', { requestId, params: body || {} });
  return res.status(202).json({ requestId, message: 'Run model requested (device)' });
});

export default router;
