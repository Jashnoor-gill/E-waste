import express from 'express';

const router = express.Router();

// Helpful GET route so visiting the endpoint in a browser returns a small hint
router.get('/run-model', (req, res) => {
  return res.json({ ok: true, route: '/api/iot/run-model', method: 'POST', note: 'POST to this endpoint. Use JSON { image_b64 } to run on server or no body to prefer device. Falls back to server if device unavailable.' });
});

// POST /run-model: prefer running on a connected device; if none available, forward to MODEL_SERVICE_URL or simulate.
router.post('/run-model', async (req, res) => {
  try {
    const body = (req && req.body && Object.keys(req.body).length) ? req.body : {};

    // If image_b64 provided, always run on server model service
    if (body.image_b64) {
      const FALLBACK_MODEL_SERVICE = 'https://e-waste-1-agt0.onrender.com/infer';
      const modelUrlFromEnv = ((process.env.MODEL_SERVICE_URL || '').trim()) || FALLBACK_MODEL_SERVICE;
      if (modelUrlFromEnv) {
        try {
          const mod = await import('node-fetch');
          const fetch = mod.default;
          console.log('Forwarding /api/iot/run-model (image) to model service at', modelUrlFromEnv);
          const resp = await fetch(modelUrlFromEnv, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image_b64: body.image_b64 }), timeout: 15000 });
          const txt = await resp.text();
          if (resp.ok) {
            try { return res.json(JSON.parse(txt)); } catch (e) { return res.status(200).send(txt); }
          } else {
            console.warn('Model service returned non-OK for image input', resp.status, txt.slice(0,200));
          }
        } catch (err) {
          console.error('Forward to MODEL_SERVICE_URL failed for image input:', err);
        }
      }
      // fallback simulation
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const labels = ['phone', 'laptop', 'battery', 'accessory', 'unknown'];
      const label = labels[Math.floor(Math.random() * labels.length)];
      const confidence = parseFloat((Math.random() * (0.99 - 0.6) + 0.6).toFixed(2));
      return res.json({ label, confidence });
    }

    // Prefer to forward run_model to a connected device.
    // Default preference: if a device named 'raspi-1' is connected, use it.
    const devices = req.app.get('devices');
    let targetSocketId = null;
    const deviceName = body.deviceName;
    if (deviceName && devices && devices.has(deviceName)) {
      targetSocketId = devices.get(deviceName);
    } else if (devices) {
      // Prefer explicitly registered device 'raspi-1' when available
      if (devices.has('raspi-1')) {
        targetSocketId = devices.get('raspi-1');
      } else {
        const first = devices.entries().next();
        if (!first.done) targetSocketId = first.value[1];
      }
    }

    if (targetSocketId) {
      // map request id -> reply socket id if provided
      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
      const replySocketId = body.replySocketId;
      const requestMap = req.app.get('requestMap');
      // store mapping and set a timeout so callers get notified if device doesn't respond
      if (requestMap) {
        const TIMEOUT_MS = parseInt(process.env.IOT_REQUEST_TIMEOUT_MS || '20000', 10);
        // set a timer that will notify the reply socket of a timeout and cleanup
        const timeoutId = setTimeout(() => {
          try {
            if (requestMap.has(requestId)) {
              const entry = requestMap.get(requestId) || {};
              const dest = entry.replySocketId;
              if (dest) {
                try { req.app.get('io').to(dest).emit('iot-model-result', { requestId, error: 'device_timeout' }); } catch (e) { /* ignore */ }
              }
              requestMap.delete(requestId);
            }
          } catch (e) { /* ignore */ }
        }, TIMEOUT_MS);
        if (replySocketId) requestMap.set(requestId, { replySocketId, ts: Date.now(), timeoutId });
        else requestMap.set(requestId, { ts: Date.now(), timeoutId });
      }
      req.app.get('io').to(targetSocketId).emit('run_model', { requestId, params: body || {} });
      return res.status(202).json({ requestId, message: 'Run model requested (device)' });
    }

    // No device available -> fallback to server model service (same as image flow)
    const FALLBACK_MODEL_SERVICE = 'https://e-waste-1-agt0.onrender.com/infer';
    const modelUrlFromEnv = ((process.env.MODEL_SERVICE_URL || '').trim()) || FALLBACK_MODEL_SERVICE;
    if (modelUrlFromEnv) {
      try {
        const mod = await import('node-fetch');
        const fetch = mod.default;
        console.log('No device connected — forwarding /api/iot/run-model to model service at', modelUrlFromEnv);
        const resp = await fetch(modelUrlFromEnv, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), timeout: 15000 });
        const txt = await resp.text();
        if (resp.ok) {
          try { return res.json(JSON.parse(txt)); } catch (e) { return res.status(200).send(txt); }
        } else {
          console.warn('Model service returned non-OK, falling back to simulation', resp.status, txt.slice(0,200));
        }
      } catch (err) {
        console.error('Forward to MODEL_SERVICE_URL failed, falling back to simulation:', err);
      }
    }

    // Fallback simulation
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
