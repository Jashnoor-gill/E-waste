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
  // If no device connected, allow a simulated response for local testing.
  // Set env SKIP_DEVICE_FORWARDING=true to enable simulation (default: true for easier local testing).
  const skipDevice = (process.env.SKIP_DEVICE_FORWARDING || 'true').toLowerCase() === 'true';
  if (!targetSocketId) {
    if (skipDevice) {
      const requestId = makeReqId();
      // simple placeholder image (tiny base64) to allow downstream testing
      const placeholderB64 = Buffer.from('simulated-image-bytes').toString('base64');
      // If caller provided a replySocketId, emit iot-photo so UI that listens on sockets still works
      const replySocketId = req.body && req.body.replySocketId;
      const requestMap = req.app.get('requestMap');
      if (replySocketId && requestMap) requestMap.set(requestId, { replySocketId, ts: Date.now() });
      try {
        if (replySocketId) {
          const io = req.app.get('io');
          if (io) io.to(replySocketId).emit('iot-photo', { requestId, image_b64: placeholderB64, simulated: true });
        }
      } catch (e) { /* ignore */ }
      return res.status(200).json({ requestId, image_b64: placeholderB64, simulated: true });
    }
    return res.status(503).json({ error: 'No IoT device connected' });
  }
  const requestId = makeReqId();
  // map requestId -> reply socket id (if provided by caller)
  const replySocketId = req.body && req.body.replySocketId;
  const requestMap = req.app.get('requestMap');
  if (replySocketId && requestMap) requestMap.set(requestId, { replySocketId, ts: Date.now() });
  io.to(targetSocketId).emit('capture', { requestId, metadata: req.body && req.body.metadata });
  return res.status(202).json({ requestId, message: 'Capture requested' });
});

export default router;
