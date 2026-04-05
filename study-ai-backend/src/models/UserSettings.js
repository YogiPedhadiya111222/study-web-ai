const mongoose = require('mongoose');

const UserSettingsSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true, trim: true, default: 'default' },
    profile: {
      name: { type: String, default: 'Deep Focus', trim: true },
      avatar: { type: String, default: 'DF', trim: true },
      bio: { type: String, default: '', trim: true },
    },
    appearance: {
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'dark' },
    },
    notifications: {
      enabled: { type: Boolean, default: true },
      dailyReminder: { type: Boolean, default: true },
      reminderTime: { type: String, default: '09:00' },
    },
    studyPreferences: {
      defaultSessionMinutes: { type: Number, default: 45, min: 5, max: 240 },
      breakMinutes: { type: Number, default: 10, min: 1, max: 60 },
      weeklyGoalMinutes: { type: Number, default: 300, min: 0, max: 5000 },
    },
    focusMode: {
      enabled: { type: Boolean, default: false },
      autoStart: { type: Boolean, default: true },
      sound: { type: Boolean, default: false },
      strictMode: { type: Boolean, default: true },
    },
    analytics: {
      showStats: { type: Boolean, default: true },
    },
    language: { type: String, enum: ['en', 'hi'], default: 'en' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('UserSettings', UserSettingsSchema);
