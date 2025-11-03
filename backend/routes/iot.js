import express from 'express';
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
  io.to(targetSocketId).emit('capture', { requestId, metadata: req.body && req.body.metadata });
  return res.status(202).json({ requestId, message: 'Capture requested' });
});

// Trigger running the ML model on device and optionally hardware actuators
router.post('/run-model', async (req, res) => {
  const io = req.app.get('io');
  const devices = req.app.get('devices');
  if (!io || !devices) return res.status(500).json({ error: 'IoT not configured' });

  const deviceName = req.body && req.body.deviceName;
  let targetSocketId;
  if (deviceName && devices.has(deviceName)) targetSocketId = devices.get(deviceName);
  else {
    const first = devices.entries().next();
    if (!first.done) targetSocketId = first.value[1];
  }
  if (!targetSocketId) return res.status(503).json({ error: 'No IoT device connected' });

  const requestId = makeReqId();
  io.to(targetSocketId).emit('run_model', { requestId, params: req.body || {} });
  return res.status(202).json({ requestId, message: 'Run model requested' });
});

export default router;
