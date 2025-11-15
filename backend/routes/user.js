import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { requireAuth } from './auth.js';

const router = express.Router();

// Get all users (admin only)
router.get('/', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    console.error('Error fetching users', err);
    // Return empty users list if DB is unavailable
    return res.json([]);
  }
});

// Get user by ID (protected)
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const uid = req.params.id;
    // allow viewing own profile or admin
    if (req.user.id !== uid && req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
    const user = await User.findById(uid).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('Error fetching user', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// Update user (self or admin)
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const uid = req.params.id;
    if (req.user.id !== uid && req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
    // Prevent password being updated here directly (use separate flow)
    if (req.body.password) delete req.body.password;
    const user = await User.findByIdAndUpdate(uid, req.body, { new: true }).select('-password');
    res.json(user);
  } catch (err) {
    console.error('Error updating user', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// Delete user (admin only)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('Error deleting user', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

export default router;
