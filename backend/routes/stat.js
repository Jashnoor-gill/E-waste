import express from 'express';
import Stat from '../models/Stat.js';

const router = express.Router();

// Get stats
router.get('/', async (req, res) => {
  const stats = await Stat.findOne();
  res.json(stats);
});

// Update stats (admin only)
router.put('/', async (req, res) => {
  const stats = await Stat.findOneAndUpdate({}, req.body, { new: true, upsert: true });
  res.json(stats);
});

export default router;
