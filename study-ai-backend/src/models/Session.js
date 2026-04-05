const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  plannedDurationMinutes: { type: Number, default: 45, min: 0 },
  durationMinutes: { type: Number, default: 0, min: 0 },
  pauseCount: { type: Number, default: 0, min: 0 },
  appSwitchCount: { type: Number, default: 0, min: 0 },
  distractionTag: {
    type: String,
    enum: ['phone', 'social', 'sleepy', 'tired', 'overthinking', 'other'],
    default: undefined,
  },
  distractionDetected: { type: Boolean, default: false },
  distractionFlags: [{ type: String }],
  distractionTimeMinutes: { type: Number, default: 0, min: 0 },
  productivityScore: { type: Number, default: 0, min: 0, max: 100 },
  productivityLabel: { type: String, default: 'Needs improvement' },
  status: { type: String, enum: ['active', 'paused', 'completed'], default: 'active' },
  isPaused: { type: Boolean, default: false },
  pausedAt: { type: Date },
  totalPausedMs: { type: Number, default: 0, min: 0 },
  totalPausedTime: { type: Number, default: 0, min: 0 },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

SessionSchema.virtual('duration').get(function duration() {
  return this.durationMinutes;
});

SessionSchema.virtual('actualDurationMinutes').get(function actualDurationMinutes() {
  return this.durationMinutes;
});

SessionSchema.virtual('focusRatio').get(function focusRatio() {
  const distractionTimeMinutes = Math.max(0, this.distractionTimeMinutes || 0);
  const actualDurationMinutes = Math.max(0, this.durationMinutes || 0);
  const totalTrackedMinutes = actualDurationMinutes + distractionTimeMinutes;

  if (totalTrackedMinutes <= 0) {
    return 0;
  }

  return Math.round((actualDurationMinutes / totalTrackedMinutes) * 100);
});

SessionSchema.index({ endTime: -1 });
SessionSchema.index({ endTime: 1, startTime: -1 });
SessionSchema.index({ taskId: 1, endTime: 1 });
SessionSchema.index({ startTime: -1 });
SessionSchema.index({ distractionDetected: 1, endTime: -1 });
SessionSchema.index({ distractionTag: 1, endTime: -1 });

module.exports = mongoose.model('Session', SessionSchema);
