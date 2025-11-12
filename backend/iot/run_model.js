import express from 'express';

const router = express.Router();

// Simulated model runner (no Python required). Returns a random label/confidence after a short delay.
router.post('/run-model', async (req, res) => {
  try {
    // Simulate inference latency
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const labels = ['phone', 'laptop', 'battery', 'accessory', 'unknown'];
    const label = labels[Math.floor(Math.random() * labels.length)];
    const confidence = parseFloat((Math.random() * (0.99 - 0.6) + 0.6).toFixed(2));

    return res.json({ label, confidence });
  } catch (error) {
    console.error('Run-model simulation error:', error);
    return res.status(500).json({ error: 'Model simulation failed', details: String(error) });
  }
});

export default router;
