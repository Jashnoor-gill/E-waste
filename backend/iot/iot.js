import express from 'express';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
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

  // If no device connected, allow a simulated response for local testing.
  // Set env SKIP_DEVICE_FORWARDING=true to enable simulation (default: true for easier local testing).
  const skipDevice = (process.env.SKIP_DEVICE_FORWARDING || 'true').toLowerCase() === 'true';
  if (!targetSocketId) {
    if (skipDevice) {
      const requestId = makeReqId();
      // placeholder image as a 320x240 SVG (base64) so simulated captures render nicely
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="100%" height="100%" fill="#eef0f2"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#374151" font-family="Arial, Helvetica, sans-serif" font-size="20">Simulated Capture</text></svg>`;
      const placeholderB64 = Buffer.from(svg).toString('base64');
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
      // Additionally, if configured to run the local Pi script, attempt to execute it and forward results.
      const runLocalPi = (process.env.RUN_LOCAL_PI_SCRIPT || 'false').toLowerCase() === 'true';
      if (runLocalPi) {
        try {
          const py = process.env.PYTHON || 'python3';
          const scriptsRoot = path.resolve(process.cwd(), 'backend', 'iot', 'pi_copied', 'DP-Group-17', 'Scripts');
          const mainPy = path.join(scriptsRoot, 'main.py');
          if (fs.existsSync(mainPy)) {
            const tmpDir = process.env.TMPDIR || process.env.TEMP || process.env.TMP || '/tmp';
            const tmpImage = path.join(tmpDir, `ew_capture_${requestId}.jpg`);
            const tmpJson = path.join(tmpDir, `ew_result_${requestId}.json`);
            // run main.py with outfile and result-file
            const args = [mainPy, '--outfile', tmpImage, '--result-file', tmpJson];
            const proc = spawnSync(py, args, { timeout: 120000, windowsHide: true });
            if (proc.error) {
              console.error('Failed to run local Pi script:', proc.error);
            } else if (proc.status !== 0) {
              console.error('Pi script exited non-zero:', proc.status, proc.stderr && proc.stderr.toString());
            } else {
              // Attempt to read result JSON and image
              if (fs.existsSync(tmpJson)) {
                try {
                  const txt = fs.readFileSync(tmpJson, 'utf8');
                  const parsed = JSON.parse(txt);
                  const imgPath = parsed.image_path || tmpImage;
                  let b64 = placeholderB64;
                  if (fs.existsSync(imgPath)) {
                    const buf = fs.readFileSync(imgPath);
                    b64 = buf.toString('base64');
                  }
                  // emit events if replySocketId present
                  if (replySocketId) {
                    const io = req.app.get('io');
                    if (io) {
                      io.to(replySocketId).emit('iot-photo', { requestId, image_b64: b64, simulated: false });
                      io.to(replySocketId).emit('iot-model-result', { requestId, result: parsed, simulated: false });
                    }
                  }
                  return res.status(200).json({ requestId, image_b64: b64, result: parsed, simulated: false });
                } catch (e) {
                  console.error('Failed to parse result JSON', e);
                }
              }
            }
          }
        } catch (e) {
          console.error('Error while attempting to run local Pi script', e);
        }
      }
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

// List connected devices (convenience endpoint under /api/iot/devices)
router.get('/devices', (req, res) => {
  try {
    const devices = req.app.get('devices');
    if (!devices) return res.json({ devices: [], count: 0 });
    const out = [];
    for (const [name, socketId] of devices.entries()) out.push({ name, socketId });
    return res.json({ devices: out, count: out.length });
  } catch (e) {
    return res.status(500).json({ error: 'failed to list devices' });
  }
});

// Remote-capture endpoint: always run local/tracked Pi script and return image + model result
router.post('/remote-capture', async (req, res) => {
  const requestId = makeReqId();
  const io = req.app.get('io');
  try {
    const py = process.env.PYTHON || 'python3';
    const scriptsRoot = path.resolve(process.cwd(), 'backend', 'iot', 'pi_copied', 'DP-Group-17', 'Scripts');
    const mainPy = path.join(scriptsRoot, 'main.py');
    if (!fs.existsSync(mainPy)) return res.status(500).json({ error: 'local pi main.py not found', path: mainPy });
    const tmpDir = process.env.TMPDIR || process.env.TEMP || process.env.TMP || '/tmp';
    const tmpImage = path.join(tmpDir, `ew_capture_${requestId}.jpg`);
    const tmpJson = path.join(tmpDir, `ew_result_${requestId}.json`);
    const args = [mainPy, '--outfile', tmpImage, '--result-file', tmpJson];
    const proc = spawnSync(py, args, { timeout: 120000, windowsHide: true });
    if (proc.error) {
      console.error('Failed to run local Pi script:', proc.error);
      return res.status(500).json({ error: 'failed to run local pi script', details: String(proc.error) });
    }
    if (proc.status !== 0) {
      const stderr = proc.stderr ? proc.stderr.toString() : '<no stderr>';
      console.error('Pi script exit', proc.status, stderr);
      return res.status(500).json({ error: 'pi script non-zero exit', status: proc.status, stderr });
    }
    let parsed = null;
    if (fs.existsSync(tmpJson)) {
      try { parsed = JSON.parse(fs.readFileSync(tmpJson, 'utf8')); } catch (e) { parsed = { error: 'failed to parse result json' }; }
    }
    let b64 = null;
    const imagePath = (parsed && parsed.image_path) ? parsed.image_path : tmpImage;
    if (fs.existsSync(imagePath)) b64 = fs.readFileSync(imagePath).toString('base64');
    // Emit to any listening sockets if desired
    const emitTo = req.body && req.body.replySocketId;
    if (emitTo && io) {
      io.to(emitTo).emit('iot-photo', { requestId, image_b64: b64 });
      io.to(emitTo).emit('iot-model-result', { requestId, result: parsed });
    }
    return res.json({ requestId, image_b64: b64, result: parsed });
  } catch (e) {
    console.error('remote-capture error', e);
    return res.status(500).json({ error: 'remote-capture-failed', details: String(e) });
  }
});

export default router;
