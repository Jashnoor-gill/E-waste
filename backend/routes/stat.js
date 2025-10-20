import express from 'express';
import mongoose from 'mongoose';
import Stat from '../models/Stat.js';
import { mockStats } from '../mockData.js';

const router = express.Router();

// Get stats
router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json(mockStats);
    }
    const stats = await Stat.findOne();
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
