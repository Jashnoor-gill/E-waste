import express from 'express';
import mongoose from 'mongoose';
import Bin from '../models/Bin.js';
import { mockBins } from '../mockData.js';

const router = express.Router();

// Get all bins
router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json(mockBins);
    }
    const bins = await Bin.find();
    res.json(bins);
  } catch (err) {
    res.json(mockBins);
  }
});

// Get bin by ID
router.get('/:id', async (req, res) => {
  const bin = await Bin.findById(req.params.id);
  if (!bin) return res.status(404).json({ error: 'Bin not found' });
  res.json(bin);
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

export default router;
