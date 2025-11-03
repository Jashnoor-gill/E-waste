import express from 'express';
import multer from 'multer';
import { callModelServiceWithRetries as callModelService } from '../utils/modelClient.js';
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Accept multipart form-data with field `file` and forward to model service by base64-encoding
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file required' });
  const buffer = req.file.buffer;
  const b64 = buffer.toString('base64');
  const MODEL_SERVICE_URL = process.env.MODEL_SERVICE_URL || 'http://localhost:8001/infer';
  try {
    const result = await callModelService(MODEL_SERVICE_URL, { image_b64: b64 });
    return res.json({ ok: true, result });
  } catch (err) {
    console.error('model upload failed', err);
    return res.status(502).json({ error: 'model_service_failed', details: String(err) });
  }
});

export default router;
