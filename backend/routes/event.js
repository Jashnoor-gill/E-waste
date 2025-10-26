import express from 'express';
import mongoose from 'mongoose';
import Event from '../models/Event.js';
import { mockEvents } from '../mockData.js';
import { shouldUseMock } from '../utils/mockUtil.js';

const router = express.Router();

// Get all events
router.get('/', async (req, res) => {
  try {
    const events = await Event.find().populate('user bin');
    const useMock = shouldUseMock(req, !events || events.length === 0 || mongoose.connection.readyState !== 1);
    if (useMock) return res.json(mockEvents);
    res.json(events);
  } catch (err) {
    res.json(mockEvents);
  }
});

// Create event
router.post('/', async (req, res) => {
  try {
    const useMock = shouldUseMock(req, mongoose.connection.readyState !== 1);
    if (useMock) {
      const event = { _id: String(Date.now()), ...req.body, timestamp: new Date().toISOString() };
      mockEvents.unshift(event);
      return res.status(201).json(event);
    }
    const event = new Event(req.body);
    await event.save();
    res.status(201).json(event);
  } catch (err) {
    res.status(201).json({ _id: String(Date.now()), ...req.body, timestamp: new Date().toISOString() });
  }
});

export default router;
