import express from 'express';
const router = express.Router();

// Simple mocked inference endpoint for demo purposes.
// POST /api/iot/mock/infer
// Body: { replySocketId?: string, metadata?: any }
router.post('/infer', async (req, res) => {
  try {
    const io = req.app.get('io');
    const replySocketId = req.body && req.body.replySocketId;
    const requestId = `mock-${Date.now()}`;
    const mocked = {
      label: 'Mobile',
      confidence: 0.87,
      note: 'This is a canned demo result (mock).'
    };

    // If a replySocketId is present, forward the mock result to that socket
    if (io && replySocketId) {
      io.to(replySocketId).emit('iot-model-result', { requestId, ...mocked, source: 'mock' });
    }

    return res.json({ requestId, result: mocked });
  } catch (err) {
    console.error('mock infer error', err);
    return res.status(500).json({ error: 'mock_failed' });
  }
});

export default router;
