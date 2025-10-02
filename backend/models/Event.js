import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  type: { type: String, enum: ['deposit', 'collection', 'recycle'], required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  bin: { type: mongoose.Schema.Types.ObjectId, ref: 'Bin' },
  amount: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now },
  details: { type: String }
});

export default mongoose.model('Event', eventSchema);
