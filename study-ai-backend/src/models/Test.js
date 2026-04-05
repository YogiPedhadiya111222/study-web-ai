const mongoose = require('mongoose');

const TestSchema = new mongoose.Schema({
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
  score: { type: Number, required: true, min: 0, max: 100 },
  accuracy: { type: Number, required: true, min: 0, max: 100 },
  topics: [{ type: String }],
  totalQuestions: { type: Number, default: 0 },
  correctAnswers: { type: Number, default: 0 },
  takenAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Test', TestSchema);
