const Activity = require('../models/Activity');
const Session = require('../models/Session');
const {
  getDayRange,
  getRecentDaySequence,
  getSessionDurationMinutes,
  toDayKey,
} = require('../utils/timeUtils');

const ACTIVITY_INSIGHT_FIELDS = 'appName durationMinutes category timestamp';
const SESSION_INSIGHT_FIELDS = 'startTime endTime durationMinutes totalPausedMs totalPausedTime';
const DISTRACTION_CATEGORY = 'distraction';
const WEEK_LENGTH_DAYS = 7;
const TOP_DISTRACTION_LIMIT = 3;

const getTopDistractions = (distractionByApp) => [...distractionByApp.entries()]
  .sort((left, right) => right[1] - left[1])
  .slice(0, TOP_DISTRACTION_LIMIT)
  .map(([app, time]) => ({ app, time }));

const buildSuggestions = ({ distractionTime, studyTime, productivityScore, topDistractions }) => {
  const suggestions = [];

  if (distractionTime > studyTime) {
    suggestions.push('Reduce time on distracting apps to improve focus.');
  }

  if (productivityScore < 50) {
    suggestions.push('Try scheduling study blocks and minimizing notifications.');
  }

  if (topDistractions.length > 0) {
    suggestions.push(`Limit usage of ${topDistractions[0].app} to boost productivity.`);
  }

  return suggestions;
};

const createInsightAccumulator = () => ({
  totalActivityTime: 0,
  distractionTime: 0,
  studyTime: 0,
  distractionByApp: new Map(),
});

const addActivityToInsight = (insight, activity) => {
  const durationMinutes = activity.durationMinutes || 0;
  insight.totalActivityTime += durationMinutes;

  if (activity.category !== DISTRACTION_CATEGORY) {
    return;
  }

  insight.distractionTime += durationMinutes;
  insight.distractionByApp.set(
    activity.appName,
    (insight.distractionByApp.get(activity.appName) || 0) + durationMinutes,
  );
};

const addSessionToInsight = (insight, session) => {
  insight.studyTime += getSessionDurationMinutes(session);
};

const finalizeProductivityInsight = (dayKey, insight) => {
  const totalTime = Math.max(insight.totalActivityTime, insight.studyTime + insight.distractionTime);
  const productiveTime = insight.studyTime;
  const unproductiveTime = insight.distractionTime;
  const neutralTime = Math.max(0, totalTime - productiveTime - unproductiveTime);
  const productivityScore = totalTime > 0
    ? Math.round((productiveTime / totalTime) * 100)
    : 0;
  const topDistractions = getTopDistractions(insight.distractionByApp);

  return {
    date: dayKey,
    totalActivityTime: totalTime,
    productiveTime,
    unproductiveTime,
    neutralTime,
    productivityScore,
    topDistractions,
    suggestions: buildSuggestions({
      distractionTime: insight.distractionTime,
      studyTime: insight.studyTime,
      productivityScore,
      topDistractions,
    }),
  };
};

const getProductivityDataForRange = (start, end) => Promise.all([
  Activity.find({ timestamp: { $gte: start, $lte: end } })
    .select(ACTIVITY_INSIGHT_FIELDS)
    .lean(),
  Session.find({ endTime: { $gte: start, $lte: end } })
    .select(SESSION_INSIGHT_FIELDS)
    .lean(),
]);

const getProductivityInsights = async (date = new Date()) => {
  const { dayKey, start, end } = getDayRange(date);
  const [activities, sessions] = await getProductivityDataForRange(start, end);
  const insight = createInsightAccumulator();

  activities.forEach((activity) => addActivityToInsight(insight, activity));
  sessions.forEach((session) => addSessionToInsight(insight, session));

  return finalizeProductivityInsight(dayKey, insight);
};

const getWeeklyProductivity = async () => {
  const days = getRecentDaySequence(WEEK_LENGTH_DAYS);
  const dayKeys = days.map(({ dayKey }) => dayKey);
  const { start } = getDayRange(days[0].date);
  const { end } = getDayRange(days[days.length - 1].date);
  const [activities, sessions] = await getProductivityDataForRange(start, end);
  const insightsByDay = new Map(dayKeys.map((dayKey) => [dayKey, createInsightAccumulator()]));

  activities.forEach((activity) => {
    const insight = insightsByDay.get(toDayKey(activity.timestamp));
    if (insight) {
      addActivityToInsight(insight, activity);
    }
  });

  sessions.forEach((session) => {
    const insight = insightsByDay.get(toDayKey(session.endTime));
    if (insight) {
      addSessionToInsight(insight, session);
    }
  });

  return dayKeys.map((dayKey) => finalizeProductivityInsight(dayKey, insightsByDay.get(dayKey)));
};

module.exports = {
  getProductivityInsights,
  getWeeklyProductivity,
};
