import express from 'express';

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

export default router;
