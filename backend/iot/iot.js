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

export default router;
