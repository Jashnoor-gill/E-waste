import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { mockUsers } from '../mockData.js';
import { shouldUseMock } from '../utils/mockUtil.js';

const router = express.Router();

// Get all users (admin only)
router.get('/', async (req, res) => {
  try {
    const users = await User.find();
    const useMock = shouldUseMock(req, !users || users.length === 0 || mongoose.connection.readyState !== 1);
    if (useMock) return res.json(mockUsers);
    res.json(users);
  } catch (err) {
    res.json(mockUsers);
  }
});

// Get user by ID
router.get('/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// Update user (admin only)
router.put('/:id', async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(user);
});

// Delete user (admin only)
router.delete('/:id', async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ message: 'User deleted' });
});

export default router;
