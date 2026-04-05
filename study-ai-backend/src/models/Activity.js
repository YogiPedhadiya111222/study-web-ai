const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema({
  appName: { type: String, required: true },
  durationMinutes: { type: Number, required: true, min: 0 },
  category: { type: String, enum: ['study', 'distraction'], required: true },
  timestamp: { type: Date, default: Date.now },
  userId: { type: String, default: 'default' }, // For future multi-user
}, { timestamps: true });

ActivitySchema.index({ timestamp: -1 });

module.exports = mongoose.model('Activity', ActivitySchema);
