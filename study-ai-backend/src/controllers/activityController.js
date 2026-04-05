const Activity = require('../models/Activity');
const { getUtcDayRange } = require('../utils/timeUtils');

const LATEST_FIRST_SORT = { timestamp: -1 };

const findActivities = (filter = {}) => Activity.find(filter).sort(LATEST_FIRST_SORT).lean();

const sendNotFound = (res) => res.status(404).json({ message: 'Activity not found' });

const getRequestedDateRange = ({ start, end }) => {
  const todayRange = getUtcDayRange();

  return {
    startDate: new Date(start || todayRange.start.toISOString()),
    endDate: new Date(end || todayRange.end.toISOString()),
  };
};

const createActivity = async (req, res, next) => {
  try {
    const activity = await Activity.create(req.body);
    res.status(201).json(activity);
  } catch (err) {
    next(err);
  }
};

const getActivities = async (req, res, next) => {
  try {
    const activities = await findActivities();
    res.json(activities);
  } catch (err) {
    next(err);
  }
};

const getActivityById = async (req, res, next) => {
  try {
    const activity = await Activity.findById(req.params.id).lean();
    if (!activity) return sendNotFound(res);
    res.json(activity);
  } catch (err) {
    next(err);
  }
};

const getActivitiesByDateRange = async (req, res, next) => {
  try {
    const { startDate, endDate } = getRequestedDateRange(req.query);
    const activities = await findActivities({
      timestamp: { $gte: startDate, $lte: endDate },
    });
    res.json(activities);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createActivity,
  getActivities,
  getActivityById,
  getActivitiesByDateRange,
};
