import express from 'express';
import mongoose from 'mongoose';
import Stat from '../models/Stat.js';

const router = express.Router();

// Get stats
router.get('/', async (req, res) => {
  try {
    const stats = await Stat.findOne();
    res.json(stats);
  } catch (err) {
    console.error('Error fetching stats', err);
    // Return empty stats object when DB is unavailable
    return res.json({});
  }
});

// Update stats (admin only)
router.put('/', async (req, res) => {
  const stats = await Stat.findOneAndUpdate({}, req.body, { new: true, upsert: true });
  res.json(stats);
});

export default router;
