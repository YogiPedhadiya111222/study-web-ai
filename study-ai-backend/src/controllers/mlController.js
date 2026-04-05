const mlPredictionService = require('../services/mlPredictionService');

const getOptimalTimes = async (req, res, next) => {
  try {
    const optimalTimes = await mlPredictionService.predictOptimalTimes();
    res.json({ optimalStudyTimes: optimalTimes });
  } catch (err) {
    next(err);
  }
};

const getPersonalizedSchedule = async (req, res, next) => {
  try {
    const schedule = await mlPredictionService.getPersonalizedSchedule();
    res.json({ personalizedSchedule: schedule });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getOptimalTimes,
  getPersonalizedSchedule,
};