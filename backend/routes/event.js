import express from 'express';
import mongoose from 'mongoose';
import Event from '../models/Event.js';
import { requireAuth } from './auth.js';

const router = express.Router();

// Get all events
router.get('/', async (req, res) => {
  try {
    const q = {};
    // support optional user filter: /api/events?user=<userId>
    if (req.query && req.query.user) {
      // validate ObjectId
      if (mongoose.Types.ObjectId.isValid(req.query.user)) q.user = req.query.user;
    }
    const events = await Event.find(q).populate('user bin');
    res.json(events);
  } catch (err) {
    console.error('Error fetching events', err);
    // Return empty events when DB is unavailable to avoid breaking frontend
    return res.json([]);
  }
});

// Create event (authenticated) - attach user from JWT
router.post('/', requireAuth, async (req, res) => {
  try {
    const body = { ...req.body };
    // prefer authoritative user id from token
    body.user = req.user && req.user.id ? req.user.id : body.user;
    const event = new Event(body);
    await event.save();
    // populate user/bin for response convenience
    await event.populate('user bin');
    res.status(201).json(event);
  } catch (err) {
    console.error('Error creating event', err);
    return res.status(500).json({ error: 'failed_to_create_event' });
  }
});

export default router;
