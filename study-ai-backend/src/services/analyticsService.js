const Task = require('../models/Task');
const Session = require('../models/Session');
const Test = require('../models/Test');
const {
  getDayRange,
  getRecentDaySequence,
  getSessionDurationMinutes,
  toDayKey,
} = require('../utils/timeUtils');
const {
  analyzeDistraction,
  getProductivityLabel,
  normalizeDistractionTag,
  sanitizePlannedDurationMinutes,
} = require('./distractionService');

const COMPLETED_SESSION_FILTER = {
  taskId: { $exists: true, $ne: null },
  endTime: { $exists: true, $ne: null },
};

const DAY_MS = 1000 * 60 * 60 * 24;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DASHBOARD_TASK_FIELDS = 'status subject testHistory createdAt';
const DASHBOARD_SESSION_FIELDS = 'taskId startTime endTime durationMinutes totalPausedMs totalPausedTime';
const SUBJECT_ANALYTICS_FIELDS = 'taskId startTime endTime durationMinutes totalPausedMs totalPausedTime';
const TEST_SCORE_FIELDS = 'score';
const STREAK_SESSION_FIELDS = 'endTime';
const WEEKLY_SESSION_FIELDS =
  'taskId startTime endTime plannedDurationMinutes durationMinutes pauseCount appSwitchCount distractionTag distractionDetected distractionFlags distractionTimeMinutes productivityScore productivityLabel totalPausedMs totalPausedTime';
const WEEK_LENGTH_DAYS = 7;
const MONTH_LENGTH_DAYS = 30;
const BEHAVIOR_LOOKBACK_DAYS = MONTH_LENGTH_DAYS + WEEK_LENGTH_DAYS;
const ANALYTICS_DEBUG_SAMPLE_LIMIT = 5;
const DISTRACTION_TIME_SLOTS = [
  { key: 'night', label: 'night', minHour: 0, maxHour: 5 },
  { key: 'morning', label: 'morning', minHour: 5, maxHour: 12 },
  { key: 'afternoon', label: 'afternoon', minHour: 12, maxHour: 17 },
  { key: 'evening', label: 'evening', minHour: 17, maxHour: 24 },
];

const createSubjectMetrics = () => ({ time: 0, tests: [] });
const createSubjectAnalytics = () => ({ timeMinutes: 0, taskIds: new Set() });

const getSubjectMetrics = (subjectData, subject) => {
  if (!subjectData[subject]) {
    subjectData[subject] = createSubjectMetrics();
  }

  return subjectData[subject];
};

const getSubjectAnalytics = (subjectData, subject) => {
  if (!subjectData[subject]) {
    subjectData[subject] = createSubjectAnalytics();
  }

  return subjectData[subject];
};

const createWeeklyStudyEntry = ({ date, dayKey }) => ({
  day: DAY_NAMES[date.getDay()],
  date: dayKey,
  studyTime: 0,
  productivity: 0,
  distractionTime: 0,
  focusRatio: 0,
  _focusMinutes: 0,
  _distractionMinutes: 0,
  _productivityTotal: 0,
  _sessionCount: 0,
});

const getBestStudyDay = (studyData) => {
  const bestDay = studyData.reduce(
    (best, current) => (current.studyTime > (best?.studyTime ?? 0) ? current : best),
    null,
  );

  if (!bestDay || bestDay.studyTime <= 0) {
    return null;
  }

  return {
    day: bestDay.day,
    date: bestDay.date,
    studyTime: bestDay.studyTime,
  };
};

const getStudyStreakSummary = (studyData) => {
  let currentDays = 0;
  for (let index = studyData.length - 1; index >= 0; index -= 1) {
    if (studyData[index].studyTime <= 0) {
      break;
    }

    currentDays += 1;
  }

  let longestDays = 0;
  let runningDays = 0;
  studyData.forEach((entry) => {
    if (entry.studyTime > 0) {
      runningDays += 1;
      longestDays = Math.max(longestDays, runningDays);
      return;
    }

    runningDays = 0;
  });

  return {
    currentDays,
    longestDays,
  };
};

const getTrendSummary = (currentMinutes, previousMinutes) => {
  const deltaMinutes = currentMinutes - previousMinutes;
  const direction = deltaMinutes === 0 ? 'flat' : deltaMinutes > 0 ? 'up' : 'down';
  const percentChange =
    previousMinutes > 0
      ? Math.round((deltaMinutes / previousMinutes) * 100)
      : currentMinutes > 0
        ? 100
        : 0;

  return {
    direction,
    deltaMinutes,
    percentChange,
    previousTotalMinutes: previousMinutes,
  };
};

const getSessionPausedMinutes = (session) => {
  if (typeof session?.totalPausedTime === 'number') {
    return Math.max(0, session.totalPausedTime);
  }

  if (typeof session?.totalPausedMs === 'number') {
    return Math.max(0, Math.floor(session.totalPausedMs / 1000 / 60));
  }

  return 0;
};

const getSessionBehaviorMetrics = (session) => {
  const actualDurationMinutes = getSessionDurationMinutes(session);
  const totalPausedMinutes = getSessionPausedMinutes(session);
  const plannedDurationMinutes = sanitizePlannedDurationMinutes(session?.plannedDurationMinutes, 45);
  const baseAnalysis = analyzeDistraction({
    actualDurationMinutes,
    plannedDurationMinutes,
    pauseCount: session?.pauseCount,
    totalPausedMinutes,
    appSwitchCount: session?.appSwitchCount,
  });
  const distractionTimeMinutes =
    typeof session?.distractionTimeMinutes === 'number'
      ? Math.max(0, session.distractionTimeMinutes)
      : baseAnalysis.distractionTimeMinutes;
  const productivityScore =
    typeof session?.productivityScore === 'number' ? session.productivityScore : baseAnalysis.productivityScore;
  const distractionDetected =
    typeof session?.distractionDetected === 'boolean' ? session.distractionDetected : baseAnalysis.distractionDetected;
  const totalFocusWindow = actualDurationMinutes + distractionTimeMinutes;

  return {
    actualDurationMinutes,
    plannedDurationMinutes,
    distractionTimeMinutes,
    productivityScore,
    productivityLabel: session?.productivityLabel || getProductivityLabel(productivityScore),
    distractionDetected,
    distractionTag: normalizeDistractionTag(session?.distractionTag),
    focusRatio: totalFocusWindow > 0 ? Math.round((actualDurationMinutes / totalFocusWindow) * 100) : 0,
  };
};

const summarizeBehaviorPeriod = (sessions) => {
  let focusMinutes = 0;
  let distractionMinutes = 0;
  let productivityTotal = 0;
  let sessionCount = 0;
  let distractedSessions = 0;

  sessions.forEach((session) => {
    const metrics = getSessionBehaviorMetrics(session);
    focusMinutes += metrics.actualDurationMinutes;
    distractionMinutes += metrics.distractionTimeMinutes;
    productivityTotal += metrics.productivityScore;
    sessionCount += 1;

    if (metrics.distractionDetected) {
      distractedSessions += 1;
    }
  });

  const totalTrackedWindow = focusMinutes + distractionMinutes;

  return {
    focusMinutes,
    distractionMinutes,
    focusRatio: totalTrackedWindow > 0 ? Math.round((focusMinutes / totalTrackedWindow) * 100) : 0,
    productivityScore: sessionCount > 0 ? Math.round(productivityTotal / sessionCount) : 0,
    sessions: sessionCount,
    distractedSessions,
  };
};

const getTwoHourWindowLabel = (startHour) => {
  const formatHour = (hour) => {
    const normalizedHour = ((hour % 24) + 24) % 24;
    const suffix = normalizedHour >= 12 ? 'PM' : 'AM';
    const twelveHour = normalizedHour % 12 || 12;
    return `${twelveHour} ${suffix}`;
  };

  return `${formatHour(startHour)} - ${formatHour(startHour + 2)}`;
};

const getPeakDistractionWindow = (sessions) => {
  const buckets = new Map();

  sessions.forEach((session) => {
    const metrics = getSessionBehaviorMetrics(session);
    if (!metrics.distractionDetected || !session?.startTime) {
      return;
    }

    const sessionStart = new Date(session.startTime);
    if (Number.isNaN(sessionStart.getTime())) {
      return;
    }

    const bucketStart = Math.floor(sessionStart.getHours() / 2) * 2;
    const currentBucket = buckets.get(bucketStart) || { minutes: 0, sessions: 0 };
    currentBucket.minutes += Math.max(1, metrics.distractionTimeMinutes);
    currentBucket.sessions += 1;
    buckets.set(bucketStart, currentBucket);
  });

  const bestBucket = [...buckets.entries()].sort((left, right) => right[1].minutes - left[1].minutes)[0];

  if (!bestBucket) {
    return null;
  }

  return {
    label: getTwoHourWindowLabel(bestBucket[0]),
    startHour: bestBucket[0],
    distractionMinutes: bestBucket[1].minutes,
    sessionCount: bestBucket[1].sessions,
  };
};

const getMostCommonDistraction = (sessions) => {
  const tagTotals = new Map();

  sessions.forEach((session) => {
    const metrics = getSessionBehaviorMetrics(session);
    if (!metrics.distractionTag) {
      return;
    }

    const currentTag = tagTotals.get(metrics.distractionTag) || { count: 0, minutes: 0 };
    currentTag.count += 1;
    currentTag.minutes += metrics.distractionTimeMinutes;
    tagTotals.set(metrics.distractionTag, currentTag);
  });

  const topTag = [...tagTotals.entries()].sort((left, right) => {
    if (right[1].count !== left[1].count) {
      return right[1].count - left[1].count;
    }

    return right[1].minutes - left[1].minutes;
  })[0];

  if (!topTag) {
    return null;
  }

  return {
    tag: topTag[0],
    count: topTag[1].count,
    distractionMinutes: topTag[1].minutes,
  };
};

const getDistractionTagBreakdown = (sessions) => {
  const tagTotals = new Map();

  sessions.forEach((session) => {
    const metrics = getSessionBehaviorMetrics(session);
    if (!metrics.distractionTag) {
      return;
    }

    const currentTag = tagTotals.get(metrics.distractionTag) || { count: 0, distractionMinutes: 0 };
    currentTag.count += 1;
    currentTag.distractionMinutes += metrics.distractionTimeMinutes;
    tagTotals.set(metrics.distractionTag, currentTag);
  });

  return [...tagTotals.entries()]
    .map(([tag, values]) => ({
      tag,
      count: values.count,
      distractionMinutes: values.distractionMinutes,
    }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return right.distractionMinutes - left.distractionMinutes;
    });
};

const getScoreBreakdown = (sessions) => {
  const breakdown = {
    excellent: 0,
    good: 0,
    needsImprovement: 0,
  };

  sessions.forEach((session) => {
    const metrics = getSessionBehaviorMetrics(session);

    if (metrics.productivityScore >= 90) {
      breakdown.excellent += 1;
      return;
    }

    if (metrics.productivityScore >= 70) {
      breakdown.good += 1;
      return;
    }

    breakdown.needsImprovement += 1;
  });

  return breakdown;
};

const getFocusTimeOfDayInsight = (sessions) => {
  const periodMetrics = new Map(
    DISTRACTION_TIME_SLOTS.map((slot) => [slot.key, { label: slot.label, scoreTotal: 0, count: 0 }]),
  );

  sessions.forEach((session) => {
    if (!session?.startTime) {
      return;
    }

    const sessionStart = new Date(session.startTime);
    if (Number.isNaN(sessionStart.getTime())) {
      return;
    }

    const period = DISTRACTION_TIME_SLOTS.find(
      (slot) => sessionStart.getHours() >= slot.minHour && sessionStart.getHours() < slot.maxHour,
    );

    if (!period) {
      return;
    }

    const periodEntry = periodMetrics.get(period.key);
    const metrics = getSessionBehaviorMetrics(session);
    periodEntry.scoreTotal += metrics.productivityScore;
    periodEntry.count += 1;
  });

  const bestPeriod = [...periodMetrics.values()]
    .filter((entry) => entry.count > 0)
    .map((entry) => ({
      ...entry,
      avgScore: Math.round(entry.scoreTotal / entry.count),
    }))
    .sort((left, right) => right.avgScore - left.avgScore)[0];

  if (!bestPeriod) {
    return null;
  }

  return {
    label: bestPeriod.label,
    productivityScore: bestPeriod.avgScore,
    sessions: bestPeriod.count,
  };
};

const getSessionDebugSnapshot = (session) => ({
  id: session?._id ? String(session._id) : null,
  taskId: session?.taskId?._id
    ? String(session.taskId._id)
    : session?.taskId
      ? String(session.taskId)
      : null,
  subject: session?.taskId?.subject ?? null,
  startTime: session?.startTime ? new Date(session.startTime).toISOString() : null,
  endTime: session?.endTime ? new Date(session.endTime).toISOString() : null,
  storedDurationMinutes: typeof session?.durationMinutes === 'number' ? session.durationMinutes : null,
  calculatedDurationMinutes: getSessionDurationMinutes(session),
});

const logAnalyticsSessions = (scope, sessions, meta = {}) => {
  const durations = sessions.map((session) => getSessionDurationMinutes(session));
  const nonZeroDurations = durations.filter((duration) => duration > 0);

  console.log(`[analytics:${scope}] session debug`, {
    ...meta,
    sessionCount: sessions.length,
    nonZeroDurationCount: nonZeroDurations.length,
    zeroDurationCount: durations.length - nonZeroDurations.length,
    sampleSessions: sessions.slice(0, ANALYTICS_DEBUG_SAMPLE_LIMIT).map(getSessionDebugSnapshot),
  });
};

const buildStudyRangeSnapshot = async ({ days: length, endDate = new Date(), scope = 'range' }) => {
  const days = getRecentDaySequence(length, endDate);
  const { start } = getDayRange(days[0].date);
  const { end } = getDayRange(days[days.length - 1].date);
  const sessions = await Session.find({
    ...COMPLETED_SESSION_FILTER,
    endTime: { $gte: start, $lte: end },
  })
    .select(WEEKLY_SESSION_FIELDS)
    .lean();

  logAnalyticsSessions(scope, sessions, {
    start: start.toISOString(),
    end: end.toISOString(),
    dayKeys: days.map(({ dayKey }) => dayKey),
  });

  const studyByDay = Object.create(null);
  days.forEach(({ date, dayKey }) => {
    studyByDay[dayKey] = createWeeklyStudyEntry({ date, dayKey });
  });

  sessions.forEach((session) => {
    const dayKey = toDayKey(session.endTime);
    const dayData = studyByDay[dayKey];
    const metrics = getSessionBehaviorMetrics(session);

    if (!dayData || metrics.actualDurationMinutes <= 0) {
      return;
    }

    dayData.studyTime += metrics.actualDurationMinutes;
    dayData.distractionTime += metrics.distractionTimeMinutes;
    dayData._focusMinutes += metrics.actualDurationMinutes;
    dayData._distractionMinutes += metrics.distractionTimeMinutes;
    dayData._productivityTotal += metrics.productivityScore;
    dayData._sessionCount += 1;
  });

  const data = days.map(({ dayKey }) => {
    const dayData = studyByDay[dayKey];
    const totalFocusWindow = dayData._focusMinutes + dayData._distractionMinutes;

    return {
      day: dayData.day,
      date: dayData.date,
      studyTime: dayData.studyTime,
      productivity: dayData._sessionCount > 0 ? Math.round(dayData._productivityTotal / dayData._sessionCount) : 0,
      distractionTime: dayData.distractionTime,
      focusRatio: totalFocusWindow > 0 ? Math.round((dayData._focusMinutes / totalFocusWindow) * 100) : 0,
    };
  });
  const totalMinutes = data.reduce((sum, dayData) => sum + dayData.studyTime, 0);

  return {
    start,
    end,
    data,
    totalMinutes,
  };
};

const buildWeeklyStudySnapshot = async (endDate = new Date()) => {
  const { data: weeklyData, totalMinutes: weeklyStudyMinutes } = await buildStudyRangeSnapshot({
    days: WEEK_LENGTH_DAYS,
    endDate,
    scope: 'weekly-range',
  });

  const todayStudyMinutes = weeklyData[weeklyData.length - 1]?.studyTime ?? 0;
  const yesterdayStudyMinutes = weeklyData[weeklyData.length - 2]?.studyTime ?? 0;

  return {
    todayStudyMinutes,
    yesterdayStudyMinutes,
    weeklyStudyMinutes,
    weeklyData,
  };
};

const buildMonthlyStudySnapshot = async (endDate = new Date()) => {
  const currentPeriod = await buildStudyRangeSnapshot({
    days: MONTH_LENGTH_DAYS,
    endDate,
    scope: 'monthly-range',
  });

  const previousPeriodEnd = new Date(currentPeriod.start);
  previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);

  const previousPeriod = await buildStudyRangeSnapshot({
    days: MONTH_LENGTH_DAYS,
    endDate: previousPeriodEnd,
    scope: 'monthly-previous-range',
  });

  return {
    totalMinutes: currentPeriod.totalMinutes,
    averageDailyMinutes: Math.round(currentPeriod.totalMinutes / MONTH_LENGTH_DAYS),
    activeDays: currentPeriod.data.filter((entry) => entry.studyTime > 0).length,
    bestDay: getBestStudyDay(currentPeriod.data),
    dailyBreakdown: currentPeriod.data.map((entry) => ({
      day: entry.day,
      date: entry.date,
      studyTime: entry.studyTime,
    })),
    trend: getTrendSummary(currentPeriod.totalMinutes, previousPeriod.totalMinutes),
    streak: getStudyStreakSummary(currentPeriod.data),
  };
};

const buildDistractionSummary = async (endDate = new Date()) => {
  const behaviorDays = getRecentDaySequence(BEHAVIOR_LOOKBACK_DAYS, endDate);
  const { start } = getDayRange(behaviorDays[0].date);
  const { end } = getDayRange(behaviorDays[behaviorDays.length - 1].date);
  const sessions = await Session.find({
    ...COMPLETED_SESSION_FILTER,
    endTime: { $gte: start, $lte: end },
  })
    .select(WEEKLY_SESSION_FIELDS)
    .lean();

  logAnalyticsSessions('behavior-summary', sessions, {
    start: start.toISOString(),
    end: end.toISOString(),
  });

  const weekStart = getDayRange(getRecentDaySequence(WEEK_LENGTH_DAYS, endDate)[0].date).start;
  const monthStart = getDayRange(getRecentDaySequence(MONTH_LENGTH_DAYS, endDate)[0].date).start;
  const todayRange = getDayRange(endDate);
  const previousWeekEnd = new Date(weekStart);
  previousWeekEnd.setMilliseconds(-1);
  const previousWeekStart = new Date(weekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - WEEK_LENGTH_DAYS);

  const todaySessions = sessions.filter(
    (session) => session.endTime && new Date(session.endTime) >= todayRange.start && new Date(session.endTime) <= todayRange.end,
  );
  const weekSessions = sessions.filter((session) => session.endTime && new Date(session.endTime) >= weekStart);
  const monthSessions = sessions.filter((session) => session.endTime && new Date(session.endTime) >= monthStart);
  const previousWeekSessions = sessions.filter((session) => {
    if (!session.endTime) {
      return false;
    }

    const endTimeValue = new Date(session.endTime);
    return endTimeValue >= previousWeekStart && endTimeValue <= previousWeekEnd;
  });

  const currentWeekSummary = summarizeBehaviorPeriod(weekSessions);
  const previousWeekSummary = summarizeBehaviorPeriod(previousWeekSessions);
  const distractionDeltaMinutes = currentWeekSummary.distractionMinutes - previousWeekSummary.distractionMinutes;
  const weeklyChangePercent =
    previousWeekSummary.distractionMinutes > 0
      ? Math.round((distractionDeltaMinutes / previousWeekSummary.distractionMinutes) * 100)
      : currentWeekSummary.distractionMinutes > 0
        ? 100
        : 0;
  const weeklyDirection =
    distractionDeltaMinutes === 0 ? 'flat' : distractionDeltaMinutes > 0 ? 'up' : 'down';
  const focusTimeInsight = getFocusTimeOfDayInsight(monthSessions);
  const peakWindow = getPeakDistractionWindow(monthSessions);
  const weeklyInsights = [];

  if (weeklyDirection === 'down' && previousWeekSummary.distractionMinutes > 0) {
    weeklyInsights.push(`Your distractions reduced by ${Math.abs(weeklyChangePercent)}% this week.`);
  } else if (weeklyDirection === 'up' && currentWeekSummary.distractionMinutes > 0) {
    weeklyInsights.push(`Distraction time increased by ${weeklyChangePercent}% this week.`);
  } else {
    weeklyInsights.push('Your distraction time stayed steady this week.');
  }

  if (focusTimeInsight) {
    weeklyInsights.push(`You focus better in the ${focusTimeInsight.label}.`);
  }

  if (peakWindow) {
    weeklyInsights.push(`You get distracted most around ${peakWindow.label}.`);
  }

  return {
    periods: {
      today: summarizeBehaviorPeriod(todaySessions),
      week: currentWeekSummary,
      month: summarizeBehaviorPeriod(monthSessions),
    },
    mostCommonDistraction: getMostCommonDistraction(monthSessions),
    peakWindow,
    tagBreakdown: getDistractionTagBreakdown(monthSessions),
    scoreBreakdown: getScoreBreakdown(monthSessions),
    weeklyChangePercent,
    weeklyDirection,
    weeklyInsights,
  };
};

const getSubjectStudyData = async () => {
  const sessions = await Session.find(COMPLETED_SESSION_FILTER)
    .select(SUBJECT_ANALYTICS_FIELDS)
    .populate('taskId', 'subject')
    .lean();

  logAnalyticsSessions('subject-rollup', sessions);

  const subjectData = Object.create(null);

  sessions.forEach((session) => {
    const subject = session.taskId?.subject;
    const duration = getSessionDurationMinutes(session);
    if (!subject) {
      return;
    }

    const subjectEntry = getSubjectAnalytics(subjectData, subject);
    subjectEntry.timeMinutes += duration;

    if (session.taskId?._id) {
      subjectEntry.taskIds.add(String(session.taskId._id));
    }
  });

  return Object.entries(subjectData)
    .map(([subject, data]) => ({
      subject,
      timeMinutes: data.timeMinutes,
      tasks: data.taskIds.size,
    }))
    .sort((left, right) => right.timeMinutes - left.timeMinutes);
};

const getDashboardData = async () => {
  const [tasks, sessions, tests, weeklyData] = await Promise.all([
    Task.find().select(DASHBOARD_TASK_FIELDS).lean(),
    Session.find(COMPLETED_SESSION_FILTER)
      .select(DASHBOARD_SESSION_FIELDS)
      .populate('taskId', 'subject')
      .lean(),
    Test.find().select(TEST_SCORE_FIELDS).lean(),
    buildWeeklyStudySnapshot(),
  ]);

  const totalTasks = tasks.length;
  let completedTasks = 0;
  let firstTrackedDate = null;
  let totalStudyMinutes = 0;
  const subjectData = Object.create(null);
  const studyDays = new Set();

  tasks.forEach((task) => {
    if (task.status === 'completed') {
      completedTasks += 1;
    }

    if (task.subject) {
      getSubjectMetrics(subjectData, task.subject).tests.push(...(task.testHistory || []));
    }

    if (!task.createdAt) {
      return;
    }

    const createdAt = new Date(task.createdAt);
    if (!Number.isNaN(createdAt.getTime()) && (!firstTrackedDate || createdAt < firstTrackedDate)) {
      firstTrackedDate = createdAt;
    }
  });

  sessions.forEach((session) => {
    const duration = getSessionDurationMinutes(session);
    totalStudyMinutes += duration;

    if (session.endTime) {
      studyDays.add(toDayKey(session.endTime));
    }

    const subject = session.taskId?.subject;
    if (subject) {
      getSubjectMetrics(subjectData, subject).time += duration;
    }
  });

  const now = Date.now();
  const totalDays = Math.max(1, Math.ceil((now - (firstTrackedDate ? firstTrackedDate.getTime() : now)) / DAY_MS));
  const activeDays = studyDays.size;
  const consistencyPercentage = Math.round((activeDays / totalDays) * 100);
  const avgStudyTime = totalDays > 0 ? Math.round(totalStudyMinutes / totalDays) : 0;

  const testScoresById = new Map(tests.map((test) => [String(test._id), test.score]));
  const weakSubjects = Object.entries(subjectData)
    .map(([subject, data]) => {
      const scores = data.tests
        .map((testId) => testScoresById.get(String(testId)))
        .filter((score) => typeof score === 'number');
      const avgScore = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 100;
      const weakness = 100 - avgScore + (data.time < 60 ? 20 : 0);

      return { subject, weaknessScore: Math.round(weakness) };
    })
    .sort((left, right) => right.weaknessScore - left.weaknessScore);

  return {
    totalStudyMinutes,
    todayStudyMinutes: weeklyData.todayStudyMinutes,
    totalTasks,
    completedTasks,
    activeDays,
    totalDays,
    consistencyPercentage,
    avgStudyTime,
    weakSubjects: weakSubjects.slice(0, 3),
  };
};

const getConsistencyStreak = async () => {
  const sessions = await Session.find(COMPLETED_SESSION_FILTER)
    .select(STREAK_SESSION_FIELDS)
    .sort({ endTime: -1 })
    .lean();

  const seenDays = new Set();
  let streak = 0;
  let currentDay = getDayRange().start;

  for (const session of sessions) {
    const dayKey = toDayKey(session.endTime);
    if (seenDays.has(dayKey)) {
      continue;
    }

    seenDays.add(dayKey);

    if (dayKey !== toDayKey(currentDay)) {
      break;
    }

    streak += 1;
    currentDay.setDate(currentDay.getDate() - 1);
  }

  return streak;
};

const getWeeklyProductivity = async () => {
  const { weeklyData } = await buildWeeklyStudySnapshot();
  return weeklyData;
};

const getStudyAnalytics = async () => {
  const [weeklyStudySnapshot, monthlyStudySnapshot, subjectData, distractionSummary] = await Promise.all([
    buildWeeklyStudySnapshot(),
    buildMonthlyStudySnapshot(),
    getSubjectStudyData(),
    buildDistractionSummary(),
  ]);

  console.log('[analytics:summary] response payload', {
    todayStudyMinutes: weeklyStudySnapshot.todayStudyMinutes,
    yesterdayStudyMinutes: weeklyStudySnapshot.yesterdayStudyMinutes,
    weeklyStudyMinutes: weeklyStudySnapshot.weeklyStudyMinutes,
    weeklyDataPoints: weeklyStudySnapshot.weeklyData.length,
    monthlyStudyMinutes: monthlyStudySnapshot.totalMinutes,
    monthlyDataPoints: monthlyStudySnapshot.dailyBreakdown.length,
    subjectCount: subjectData.length,
    monthlyDistractionMinutes: distractionSummary.periods.month.distractionMinutes,
  });

  return {
    ...weeklyStudySnapshot,
    monthlyStudy: monthlyStudySnapshot,
    subjectData,
    distractionSummary,
    weeklyInsights: distractionSummary.weeklyInsights,
    productivityTrend: weeklyStudySnapshot.weeklyData.map((entry) => ({
      date: entry.date,
      score: entry.productivity,
    })),
  };
};

module.exports = {
  getDashboardData,
  getConsistencyStreak,
  getStudyAnalytics,
  getWeeklyProductivity,
};
