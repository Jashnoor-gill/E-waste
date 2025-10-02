import mongoose from 'mongoose';

const statSchema = new mongoose.Schema({
  totalEwaste: { type: Number, default: 0 },
  totalUsers: { type: Number, default: 0 },
  totalBins: { type: Number, default: 0 },
  co2Saved: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('Stat', statSchema);
