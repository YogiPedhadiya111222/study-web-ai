const Activity = require('../models/Activity');
const Session = require('../models/Session');
const { getSessionDurationMinutes } = require('../utils/timeUtils');

class MLPredictionService {
  constructor() {
    this.isTrained = true; // Always use heuristics
  }

  async predictOptimalTimes() {
    // Analyze historical session data for patterns
    const sessions = await Session.find({ endTime: { $exists: true } }).sort({ startTime: -1 }).limit(50);

    if (sessions.length < 5) {
      return this.getDefaultOptimalTimes();
    }

    // Analyze successful study times (longer sessions)
    const hourCounts = {};
    const dayCounts = {};

    sessions.forEach(session => {
      const hour = session.startTime.getHours();
      const day = session.startTime.getDay();
      const duration = getSessionDurationMinutes(session);

      if (duration > 30) { // Consider successful sessions
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        dayCounts[day] = (dayCounts[day] || 0) + 1;
      }
    });

    // Find best hours and days
    const bestHours = Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));

    const bestDays = Object.entries(dayCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([day]) => parseInt(day));

    // Generate predictions
    const predictions = [];
    bestDays.forEach(day => {
      bestHours.forEach(hour => {
        const baseScore = 75 + Math.random() * 20; // 75-95%
        predictions.push({
          hour,
          dayOfWeek: day,
          predictedProductivity: Math.round(baseScore),
          timeSlot: `${hour}:00-${hour + 1}:00`,
          dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day]
        });
      });
    });

    // Add some variety for other times
    for (let day = 0; day < 7; day++) {
      if (!bestDays.includes(day)) {
        [8, 9, 10, 18, 19, 20].forEach(hour => {
          if (!bestHours.includes(hour)) {
            predictions.push({
              hour,
              dayOfWeek: day,
              predictedProductivity: Math.round(60 + Math.random() * 20), // 60-80%
              timeSlot: `${hour}:00-${hour + 1}:00`,
              dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day]
            });
          }
        });
      }
    }

    return predictions.sort((a, b) => b.predictedProductivity - a.predictedProductivity).slice(0, 10);
  }

  getDefaultOptimalTimes() {
    const times = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Morning and evening slots
    [8, 9, 10, 18, 19, 20].forEach(hour => {
      for (let day = 0; day < 7; day++) {
        times.push({
          hour,
          dayOfWeek: day,
          predictedProductivity: Math.round(70 + Math.random() * 25), // 70-95%
          timeSlot: `${hour}:00-${hour + 1}:00`,
          dayName: dayNames[day]
        });
      }
    });

    return times.sort((a, b) => b.predictedProductivity - a.predictedProductivity).slice(0, 10);
  }

  async getPersonalizedSchedule() {
    const optimalTimes = await this.predictOptimalTimes();

    // Group by day and suggest daily schedule
    const schedule = {};
    optimalTimes.forEach(time => {
      if (!schedule[time.dayName]) schedule[time.dayName] = [];
      if (schedule[time.dayName].length < 3) { // Max 3 slots per day
        schedule[time.dayName].push({
          timeSlot: time.timeSlot,
          productivity: time.predictedProductivity
        });
      }
    });

    return schedule;
  }
}

module.exports = new MLPredictionService();
