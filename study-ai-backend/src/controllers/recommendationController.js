const Task = require('../models/Task');
const Session = require('../models/Session');
const { getWeakSubjects, getRecommendations } = require('../services/recommendationService');
const { getDayRange, getSessionDurationMinutes } = require('../utils/timeUtils');
const mlPredictionService = require('../services/mlPredictionService');

const getDailyStats = async (req, res, next) => {
  try {
    const { dayKey, start, end } = getDayRange();

    const sessions = await Session.find({
      endTime: { $gte: start, $lte: end },
    });

    const totalStudyMinutes = sessions.reduce((sum, session) => sum + getSessionDurationMinutes(session), 0);
    const tasks = await Task.find();
    res.json({ date: dayKey, totalStudyMinutes, totalTasks: tasks.length, sessionsToday: sessions.length });
  } catch (err) {
    next(err);
  }
};

const weakSubjects = async (req, res, next) => {
  try {
    const subjects = await getWeakSubjects();
    res.json(subjects);
  } catch (err) {
    next(err);
  }
};

const nextUp = async (req, res, next) => {
  try {
    const recos = await getRecommendations();
    const optimalTimes = await mlPredictionService.predictOptimalTimes();
    const nextOptimalTime = optimalTimes.length > 0 ? optimalTimes[0] : null;

    res.json({
      recommendations: recos,
      suggestedStudyTime: nextOptimalTime ? {
        timeSlot: nextOptimalTime.timeSlot,
        day: nextOptimalTime.dayName,
        expectedProductivity: nextOptimalTime.predictedProductivity
      } : null
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDailyStats,
  weakSubjects,
  nextUp,
};
