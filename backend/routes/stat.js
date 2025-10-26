import express from 'express';
import mongoose from 'mongoose';
import Stat from '../models/Stat.js';
import { mockStats } from '../mockData.js';
import { shouldUseMock } from '../utils/mockUtil.js';

const router = express.Router();

// Get stats
router.get('/', async (req, res) => {
  try {
    const stats = await Stat.findOne();
    const useMock = shouldUseMock(req, !stats || mongoose.connection.readyState !== 1);
    if (useMock) return res.json(mockStats);
    res.json(stats);
  } catch (err) {
    res.json(mockStats);
  }
});

// Update stats (admin only)
router.put('/', async (req, res) => {
  const stats = await Stat.findOneAndUpdate({}, req.body, { new: true, upsert: true });
  res.json(stats);
});

export default router;
