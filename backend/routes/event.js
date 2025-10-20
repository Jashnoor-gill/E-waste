import express from 'express';
import mongoose from 'mongoose';
import Event from '../models/Event.js';
import { mockEvents } from '../mockData.js';

const router = express.Router();

// Get all events
router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json(mockEvents);
    }
    const events = await Event.find().populate('user bin');
    res.json(events);
  } catch (err) {
    res.json(mockEvents);
  }
});

// Create event
router.post('/', async (req, res) => {
  const event = new Event(req.body);
  await event.save();
  res.status(201).json(event);
});

export default router;
