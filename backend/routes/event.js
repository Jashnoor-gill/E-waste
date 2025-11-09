import express from 'express';
import mongoose from 'mongoose';
import Event from '../models/Event.js';

const router = express.Router();

// Get all events
router.get('/', async (req, res) => {
  try {
    const events = await Event.find().populate('user bin');
    res.json(events);
  } catch (err) {
    console.error('Error fetching events', err);
    return res.status(500).json({ error: 'failed_to_fetch_events' });
  }
});

// Create event
router.post('/', async (req, res) => {
  try {
    const event = new Event(req.body);
    await event.save();
    res.status(201).json(event);
  } catch (err) {
    console.error('Error creating event', err);
    return res.status(500).json({ error: 'failed_to_create_event' });
  }
});

export default router;
