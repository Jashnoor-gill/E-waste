import express from 'express';

const router = express.Router();

// Helpful GET route so visiting the endpoint in a browser returns a small hint
router.get('/run-model', (req, res) => {
  return res.json({ ok: true, route: '/api/iot/run-model', method: 'POST', note: 'POST to this endpoint. Use JSON { image_b64 } or empty body for simulated response. Set MODEL_SERVICE_URL to forward to a real model.' });
});

// POST /run-model: if MODEL_SERVICE_URL is set, forward the request there (proxy); otherwise simulate.
router.post('/run-model', async (req, res) => {
  try {
  // Prefer explicit env, but fall back to the known deployed model service if available.
  // This helps when the backend hasn't been configured with MODEL_SERVICE_URL yet.
  const FALLBACK_MODEL_SERVICE = 'https://e-waste-1-agt0.onrender.com/infer';
  const modelUrlFromEnv = ((process.env.MODEL_SERVICE_URL || '').trim()) || FALLBACK_MODEL_SERVICE;
  if (modelUrlFromEnv) {
      // if the provided URL doesn't look like it already contains /infer or similar, we won't modify it here.
      try {
        const mod = await import('node-fetch');
        const fetch = mod.default;
  const body = (req && req.body && Object.keys(req.body).length) ? req.body : {};
  console.log('Forwarding /api/iot/run-model to model service at', modelUrlFromEnv);
        const resp = await fetch(modelUrlFromEnv, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), timeout: 15000 });
        const txt = await resp.text();
        if (!resp.ok) {
          console.warn('Model service returned non-OK, falling back to simulation', resp.status, txt.slice(0,200));
          // fall through to simulation below
        } else {
          try {
            const j = JSON.parse(txt);
            return res.json(j);
          } catch (e) {
            console.warn('Model service returned non-JSON, falling back to simulation', e.message);
            // fall through to simulation below
          }
        }
      } catch (err) {
        console.error('Forward to MODEL_SERVICE_URL failed, falling back to simulation:', err);
        // fall through to simulation below
      }
    }

    // Fallback: simulated result (no external service needed)
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const labels = ['phone', 'laptop', 'battery', 'accessory', 'unknown'];
    const label = labels[Math.floor(Math.random() * labels.length)];
    const confidence = parseFloat((Math.random() * (0.99 - 0.6) + 0.6).toFixed(2));
    return res.json({ label, confidence });
  } catch (error) {
    console.error('Run-model error:', error);
    return res.status(500).json({ error: 'Model run failed', details: String(error) });
  }
});

export default router;
