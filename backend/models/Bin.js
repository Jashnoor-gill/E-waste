import mongoose from 'mongoose';

const binSchema = new mongoose.Schema({
  location: { type: String, required: true },
  status: { type: String, enum: ['available', 'full', 'collecting'], default: 'available' },
  level: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
});

export default mongoose.model('Bin', binSchema);
