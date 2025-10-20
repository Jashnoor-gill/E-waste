import express from 'express';
import mongoose from 'mongoose';
import Event from '../models/Event.js';
import { mockEvents } from '../mockData.js';

const router = express.Router();

// Get all events
router.get('/', async (req, res) => {
  try {
    const events = await Event.find().populate('user bin');
    if (!events || events.length === 0) return res.json(mockEvents);
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
