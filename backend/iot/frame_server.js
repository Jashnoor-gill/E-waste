import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { loadTokens } from '../utils/deviceTokens.js';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { MongoClient, GridFSBucket, ObjectId } from 'mongodb';

const router = express.Router();
router.use(cors());
router.use(express.json({ limit: '60mb' })); // allow larger frames if needed

// In-memory store for latest frame per device:
// deviceId -> { frame: '<base64>', ts: 12345, filepath?: '/tmp/..' }
const frames = new Map();

// SSE clients for real-time streaming: deviceId -> Set(res)
const sseClients = new Map();

function verifyDeviceToken(req) {
  // If there are no tokens configured, accept by default (dev mode).
  const tokens = loadTokens();
  if (!tokens || tokens.length === 0) return true;
  const header = req.headers['x-device-token'];
  if (!header) return false;
  return tokens.includes(String(header));
}

router.get('/health', (req, res) => res.json({ ok: true }));

// POST /upload_frame
// body: { device_id: 'raspi-1', frame: '<base64-jpeg-or-png>' }
router.post('/upload_frame', async (req, res) => {
  try {
    if (!verifyDeviceToken(req)) return res.status(403).json({ error: 'missing_or_invalid_device_token' });
    const { device_id, frame } = req.body || {};
    if (!device_id) return res.status(400).json({ error: 'device_id_required' });
    if (!frame) return res.status(400).json({ error: 'frame_required' });

    const ts = Date.now();
    const entry = { frame, ts };

    // Optionally save to disk for debugging / later processing
    if ((process.env.SAVE_FRAMES || '').toLowerCase() === 'true') {
      try {
        const buf = Buffer.from(frame, 'base64');
        const filename = `${device_id}-${ts}.jpg`;
        const dir = path.join(os.tmpdir(), 'ew-frames');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const filepath = path.join(dir, filename);
        fs.writeFileSync(filepath, buf);
        entry.filepath = filepath;
      } catch (err) {
        console.warn('Failed to save frame to disk', err.message);
      }
    }

        // Decide storage backend: gridfs (MongoDB) or S3 (existing) or memory/disk
        const FRAME_STORAGE = (process.env.FRAME_STORAGE || '').toLowerCase();
        const S3_BUCKET = (process.env.S3_BUCKET || '').trim();

        if (FRAME_STORAGE === 'gridfs') {
          // Use MongoDB GridFS to store frames. This is asynchronous — ensure upload completes before setting frames map.
          try {
            const uri = process.env.MONGODB_URI;
            if (!uri) throw new Error('MONGODB_URI not configured for GridFS');
            // create a client per process and reuse
            if (!global.__ew_mongo_client) {
              global.__ew_mongo_client = new MongoClient(uri);
              await global.__ew_mongo_client.connect();
              global.__ew_db = global.__ew_mongo_client.db();
              global.__ew_gridfs = new GridFSBucket(global.__ew_db, { bucketName: process.env.GRIDFS_BUCKET || 'frames' });
            }
            const bucket = global.__ew_gridfs;
            const buf = Buffer.from(frame, 'base64');
            const filename = `${device_id}-${ts}.jpg`;
            const uploadStream = bucket.openUploadStream(filename, { metadata: { device_id, ts }, contentType: 'image/jpeg' });
            uploadStream.end(buf, () => {
              try {
                entry.gridfsId = uploadStream.id.toString();
                if ((process.env.KEEP_FRAMES_IN_MEMORY || '').toLowerCase() !== 'true') entry.frame = null;
                frames.set(device_id, entry);
              } catch (e) {
                console.warn('GridFS upload finish handler error', e && e.message ? e.message : e);
                frames.set(device_id, entry);
              }
            });
          } catch (err) {
            console.warn('GridFS upload error', err && err.message ? err.message : err);
            frames.set(device_id, entry);
          }
        } else if (S3_BUCKET) {
          try {
            // Initialize S3 client with optional region & credentials from env
            const s3 = new S3Client({ region: process.env.S3_REGION || undefined, credentials: (process.env.S3_KEY && process.env.S3_SECRET) ? { accessKeyId: process.env.S3_KEY, secretAccessKey: process.env.S3_SECRET } : undefined });
            const buf = Buffer.from(frame, 'base64');
            const key = `frames/${device_id}/${ts}.jpg`;
            const cmd = new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: buf, ContentType: 'image/jpeg' });
            // Fire-and-forget upload but await result to ensure availability
            s3.send(cmd).then(() => {
              entry.s3Key = key;
              // remove large in-memory frame to save RAM if desired
              if ((process.env.KEEP_FRAMES_IN_MEMORY || '').toLowerCase() !== 'true') {
                entry.frame = null;
              }
              frames.set(device_id, entry);
            }).catch((err) => {
              console.warn('S3 upload failed', err && err.message ? err.message : err);
              // fallback: keep frame in-memory
              frames.set(device_id, entry);
            });
          } catch (err) {
            console.warn('S3 upload error', err && err.message ? err.message : err);
            frames.set(device_id, entry);
          }
        } else {
          frames.set(device_id, entry);
        }

    // notify SSE clients listening for this device
    const set = sseClients.get(device_id);
    if (set && set.size) {
      const payload = JSON.stringify({ device_id, ts, has_file: !!entry.filepath });
      for (const res of set) {
        try {
          res.write(`data: ${payload}\n\n`);
        } catch (e) { /* ignore */ }
      }
    }

    console.log(`Frame received from ${device_id} (size ~${String(frame).length} chars)`);
    return res.json({ status: 'ok', ts });
  } catch (err) {
    console.error('upload_frame error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// GET /latest_frame?device_id=raspi-1
router.get('/latest_frame', (req, res) => {
  const deviceId = req.query.device_id;
  if (!deviceId) return res.status(400).json({ error: 'device_id_required' });
  const entry = frames.get(deviceId);
  if (!entry) return res.status(404).json({ error: 'not_found' });
  // If frame was uploaded to S3, return a presigned URL instead of raw base64
  const FRAME_STORAGE = (process.env.FRAME_STORAGE || '').toLowerCase();
  const S3_BUCKET = (process.env.S3_BUCKET || '').trim();
  if (FRAME_STORAGE === 'gridfs' && entry.gridfsId) {
    // Return the backend streaming URL for the gridfs file
    const url = `/api/frame/get/${entry.gridfsId}`;
    return res.json({ device_id: deviceId, ts: entry.ts, gridfsId: entry.gridfsId, url, filepath: entry.filepath });
  }
  if (S3_BUCKET && entry.s3Key) {
    try {
      const s3 = new S3Client({ region: process.env.S3_REGION || undefined, credentials: (process.env.S3_KEY && process.env.S3_SECRET) ? { accessKeyId: process.env.S3_KEY, secretAccessKey: process.env.S3_SECRET } : undefined });
      const getCmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: entry.s3Key });
      // signed URL valid for short time (default 60s), can be configured via env
      const expires = parseInt(process.env.S3_PRESIGNED_EXPIRES || '60', 10);
      return getSignedUrl(s3, getCmd, { expiresIn: expires }).then((url) => {
        return res.json({ device_id: deviceId, ts: entry.ts, presignedUrl: url, filepath: entry.filepath });
      }).catch((err) => {
        console.warn('Failed to create presigned URL', err && err.message ? err.message : err);
        // fallback to returning base64 if present
        return res.json({ device_id: deviceId, ts: entry.ts, frame: entry.frame, filepath: entry.filepath });
      });
    } catch (err) {
      console.warn('Presign error', err && err.message ? err.message : err);
      return res.json({ device_id: deviceId, ts: entry.ts, frame: entry.frame, filepath: entry.filepath });
    }
  }
  return res.json({ device_id: deviceId, ts: entry.ts, frame: entry.frame, filepath: entry.filepath });
});

// GET /get/:id - stream a GridFS file by id
router.get('/get/:id', async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).send('id required');
  try {
    if (!global.__ew_gridfs) {
      const uri = process.env.MONGODB_URI;
      if (!uri) return res.status(500).send('MONGODB_URI not configured');
      if (!global.__ew_mongo_client) {
        global.__ew_mongo_client = new MongoClient(uri);
        await global.__ew_mongo_client.connect();
        global.__ew_db = global.__ew_mongo_client.db();
      }
      global.__ew_gridfs = new GridFSBucket(global.__ew_db, { bucketName: process.env.GRIDFS_BUCKET || 'frames' });
    }
    const bucket = global.__ew_gridfs;
    const oid = ObjectId.isValid(id) ? new ObjectId(id) : null;
    if (!oid) return res.status(400).send('invalid id');
    const downloadStream = bucket.openDownloadStream(oid);
    // set generic image content-type (stored in metadata if available)
    res.setHeader('Content-Type', 'image/jpeg');
    downloadStream.on('error', (err) => {
      console.warn('GridFS download error', err && err.message ? err.message : err);
      return res.status(404).send('not found');
    });
    downloadStream.pipe(res);
  } catch (err) {
    console.error('GET /get/:id error', err && err.message ? err.message : err);
    return res.status(500).send('server_error');
  }
});

// GET /devices -> list known device ids
router.get('/devices', (req, res) => {
  return res.json(Array.from(frames.keys()));
});

// SSE endpoint: clients can connect to receive notice when a new frame arrives for a device
// GET /stream/:deviceId
router.get('/stream/:deviceId', (req, res) => {
  const deviceId = req.params.deviceId;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();

  const set = sseClients.get(deviceId) || new Set();
  set.add(res);
  sseClients.set(deviceId, set);

  req.on('close', () => {
    set.delete(res);
    if (set.size === 0) sseClients.delete(deviceId);
  });
});

export default router;
