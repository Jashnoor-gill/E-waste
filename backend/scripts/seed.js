#!/usr/bin/env node
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Stat from '../models/Stat.js';
import Bin from '../models/Bin.js';
import Event from '../models/Event.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ewasteDB';

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB for seeding');

    // Clear/prepare collections (safe for development only)
    await Promise.all([
      User.deleteMany({}),
      Stat.deleteMany({}),
      Bin.deleteMany({}),
      Event.deleteMany({})
    ]);

    // Create sample users
    const users = [
      { name: 'Alice Admin', username: 'admin', email: 'admin@example.com', password: 'password123', role: 'admin' },
      { name: 'Bin User', username: 'binuser', email: 'user@example.com', password: 'password123', role: 'binuser' },
      { name: 'Collector Carl', username: 'collector', email: 'collector@example.com', password: 'password123', role: 'collector' }
    ];

    for (const u of users) {
      const hashed = await bcrypt.hash(u.password, 10);
      const doc = new User({ name: u.name, username: u.username, email: u.email.toLowerCase(), password: hashed, role: u.role });
      await doc.save();
      console.log('Created user', doc.username || doc.email, 'role', doc.role);
    }

    // Create a single stats document
    const stats = new Stat({ totalEwaste: 120.5, totalUsers: 3, totalBins: 8, co2Saved: 340.2 });
    await stats.save();
    console.log('Created stats document');

    // Create sample bins
    const sampleBins = [
      { location: 'Mall Parking Lot', capacity: 50, currentWeight: 12, status: 'Medium' },
      { location: 'University Entrance', capacity: 60, currentWeight: 42, status: 'Full' },
      { location: 'Community Center', capacity: 40, currentWeight: 5, status: 'Empty' }
    ];
    for (const b of sampleBins) {
      const bin = new Bin(b);
      await bin.save();
      console.log('Created bin', bin.location);
    }

    // Create some sample events (deposits & collections)
    const createdBins = await Bin.find().limit(3);
    const events = [
      { type: 'deposit', amount: 1.2, bin: createdBins[0]._id, category: 'phone', timestamp: Date.now() - 1000 * 60 * 60 * 24 * 3 },
      { type: 'deposit', amount: 4.5, bin: createdBins[1]._id, category: 'battery', timestamp: Date.now() - 1000 * 60 * 60 * 24 * 2 },
      { type: 'collection', amount: 20, bin: createdBins[1]._id, timestamp: Date.now() - 1000 * 60 * 60 * 24 }
    ];
    for (const e of events) {
      const ev = new Event(e);
      await ev.save();
      console.log('Created event', ev.type, ev._id.toString());
    }

    console.log('Seeding complete.');
    process.exit(0);
  } catch (err) {
    console.error('Seeding error', err);
    process.exit(1);
  }
}

seed();
