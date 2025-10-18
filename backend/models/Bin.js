import mongoose from 'mongoose';

const binSchema = new mongoose.Schema({
  location: { type: String, required: true },
  status: { type: String, enum: ['available', 'full', 'collecting'], default: 'available' },
  level: { type: Number, default: 0 },
  capacity: { type: Number, default: 100 }, // Maximum capacity in kg
  currentWeight: { type: Number, default: 0 }, // Current weight in kg
  qrCode: { type: String, unique: true }, // QR code identifier
  acceptedCategories: [{ 
    type: String, 
    enum: ['phones', 'laptops', 'tablets', 'batteries', 'chargers', 'cables', 'monitors', 'keyboards', 'other'],
    default: ['phones', 'laptops', 'tablets', 'batteries', 'chargers', 'cables', 'monitors', 'keyboards', 'other']
  }],
  lastUpdated: { type: Date, default: Date.now },
  lastCollected: { type: Date }
});

export default mongoose.model('Bin', binSchema);
