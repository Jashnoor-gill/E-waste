import express from 'express';
import mongoose from 'mongoose';
import Bin from '../models/Bin.js';

const router = express.Router();

// Get all bins
router.get('/', async (req, res) => {
  try {
    const bins = await Bin.find();
    res.json(bins);
  } catch (err) {
    console.error('Error fetching bins', err);
    // Return an empty list when DB is unavailable so frontend can still function
    return res.json([]);
  }
});

// Get bin by ID
router.get('/:id', async (req, res) => {
  const bin = await Bin.findById(req.params.id);
  if (!bin) return res.status(404).json({ error: 'Bin not found' });
  res.json(bin);
});

// Compact level endpoint: return current fill level and recent distance for a bin
router.get('/:id/level', async (req, res) => {
  try {
    const id = req.params.id;
    let bin = null;
    // support ObjectId or qrCode lookup
    if (id && /^[0-9a-fA-F]{24}$/.test(id)) {
      bin = await Bin.findById(id);
    }
    if (!bin) bin = await Bin.findOne({ qrCode: id });
    if (!bin) bin = await Bin.findOne({ _id: id }).catch(() => null);
    if (!bin) return res.status(404).json({ error: 'Bin not found' });

    return res.json({
      bin_id: String(bin._id),
      level: typeof bin.level === 'number' ? bin.level : null,
      distance_cm: typeof bin.lastDistanceCm === 'number' ? bin.lastDistanceCm : null,
      status: bin.status || null,
      lastUpdated: bin.lastUpdated || null,
    });
  } catch (err) {
    console.error('Error in GET /api/bins/:id/level', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// Create bin (admin only)
router.post('/', async (req, res) => {
  const bin = new Bin(req.body);
  await bin.save();
  res.status(201).json(bin);
});

// Update bin
router.put('/:id', async (req, res) => {
  const bin = await Bin.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(bin);
});

// Delete bin (admin only)
router.delete('/:id', async (req, res) => {
  await Bin.findByIdAndDelete(req.params.id);
  res.json({ message: 'Bin deleted' });
});

// Sensor update endpoint: accept POST /update with payload { bin_id, distance_cm, fill_percent, ts }
// This endpoint is intended for IoT devices (Raspberry Pi) to report ultrasonic readings.
router.post('/update', async (req, res) => {
  try {
    const { bin_id, distance_cm, fill_percent, ts } = req.body || {};
    if (!bin_id) return res.status(400).json({ error: 'bin_id required' });

    // Attempt to resolve bin by various strategies: by ObjectId, qrCode, or id-like field
    let bin = null;
    // try by ObjectId-ish
    if (!bin && typeof bin_id === 'string' && /^[0-9a-fA-F]{24}$/.test(bin_id)) {
      try { bin = await Bin.findById(bin_id); } catch (e) { bin = null; }
    }
    // try by qrCode
    if (!bin) bin = await Bin.findOne({ qrCode: bin_id });
    // try by explicit id field
    if (!bin) bin = await Bin.findOne({ _id: bin_id }).catch(() => null);

    if (!bin) {
      // If no bin exists, return 404 — do not auto-create without explicit admin action
      return res.status(404).json({ error: 'Bin not found' });
    }

    const updates = {};
    if (typeof fill_percent === 'number') updates.level = fill_percent;
    if (typeof distance_cm === 'number') updates.lastDistanceCm = distance_cm;
    updates.lastUpdated = ts ? new Date(ts) : new Date();

    // Derive status heuristics: if level >= 95% mark full, if >= 70% mark collecting
    const levelVal = typeof updates.level === 'number' ? updates.level : (typeof bin.level === 'number' ? bin.level : null);
    if (typeof levelVal === 'number') {
      if (levelVal >= 95) updates.status = 'full';
      else if (levelVal >= 70) updates.status = 'collecting';
      else updates.status = 'available';
    }

    const updated = await Bin.findByIdAndUpdate(bin._id, { $set: updates }, { new: true });

    // Emit socket event to notify connected clients about the update
    try {
      const io = req.app && req.app.get && req.app.get('io');
      if (io) io.emit('binStatusUpdate', updated);
    } catch (e) { /* ignore socket emission failures */ }

    return res.json({ ok: true, bin: updated });
  } catch (err) {
    console.error('Error in /api/bins/update:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
