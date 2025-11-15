import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: false },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  email: { type: String, required: false, unique: true, sparse: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['binuser', 'collector', 'admin'], default: 'binuser' },
  points: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  badges: [{ 
    name: String, 
    icon: String, 
    earnedAt: { type: Date, default: Date.now } 
  }],
  totalDeposits: { type: Number, default: 0 },
  totalWeight: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', userSchema);
