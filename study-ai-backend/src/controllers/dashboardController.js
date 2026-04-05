const { getDashboardData, getConsistencyStreak } = require('../services/analyticsService');
const { getProductivityInsights, getWeeklyProductivity } = require('../services/activityAnalysisService');

const createHandler = (resolver, formatter = (data) => data) => async (req, res, next) => {
  try {
    const result = await resolver(req);
    res.json(formatter(result));
  } catch (err) {
    next(err);
  }
};

const getDashboard = createHandler(async () => {
  const [data, productivity] = await Promise.all([
    getDashboardData(),
    getProductivityInsights(),
  ]);

  return { ...data, productivity };
});

const getStreak = createHandler(getConsistencyStreak, (currentStreak) => ({ currentStreak }));

const getProductivity = createHandler(() => getProductivityInsights());

const getWeeklyProductivityData = createHandler(getWeeklyProductivity);

module.exports = {
  getDashboard,
  getStreak,
  getProductivity,
  getWeeklyProductivity: getWeeklyProductivityData,
};
