const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  subject: { type: String, required: true, trim: true },
  expectedStudyMinutes: { type: Number, default: 0, min: 0 },
  totalStudyTime: { type: Number, default: 0, min: 0 },
  realStudyMinutes: { type: Number, default: 0, min: 0 },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  resources: [{ type: String }],
  deadline: { type: Date },
  difficulty: { type: Number, default: 3, min: 1, max: 5 },
  lastStudiedAt: { type: Date },
  priority: { type: Number, default: 0 },
  isHidden: { type: Boolean, default: false },
  sessionHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Session' }],
  testHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Test' }],
  status: { type: String, enum: ['pending', 'in-progress', 'completed'], default: 'pending' },
}, { timestamps: true });

module.exports = mongoose.model('Task', TaskSchema);
