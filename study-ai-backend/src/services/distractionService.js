const DISTRACTION_TAGS = ['phone', 'social', 'sleepy', 'tired', 'overthinking', 'other'];

const DEFAULT_PLANNED_DURATION_MINUTES = 45;
const MIN_PLANNED_DURATION_MINUTES = 15;
const MAX_PLANNED_DURATION_MINUTES = 180;
const LOW_COMPLETION_RATIO = 0.7;
const EARLY_EXIT_BUFFER_MINUTES = 10;
const FREQUENT_PAUSE_THRESHOLD = 3;
const FREQUENT_APP_SWITCH_THRESHOLD = 4;

const clampNumber = (value, min = 0, max = Number.POSITIVE_INFINITY) => {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) {
    return min;
  }

  return Math.min(max, Math.max(min, normalized));
};

const roundToWholeMinutes = (value) => Math.round(clampNumber(value, 0));

const normalizeDistractionTag = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const normalized = String(value).trim().toLowerCase();

  if (normalized === 'none' || normalized === 'focused') {
    return null;
  }

  if (DISTRACTION_TAGS.includes(normalized)) {
    return normalized;
  }

  if (normalized === 'social media') {
    return 'social';
  }

  return 'other';
};

const sanitizePlannedDurationMinutes = (value, fallback = DEFAULT_PLANNED_DURATION_MINUTES) => {
  const candidate = clampNumber(value, 0);
  if (candidate <= 0) {
    return clampNumber(fallback, MIN_PLANNED_DURATION_MINUTES, MAX_PLANNED_DURATION_MINUTES);
  }

  return clampNumber(candidate, MIN_PLANNED_DURATION_MINUTES, MAX_PLANNED_DURATION_MINUTES);
};

const getProductivityLabel = (score) => {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  return 'Needs improvement';
};

const calculateProductivityScore = ({ actualDurationMinutes = 0, plannedDurationMinutes = 0 }) => {
  const actual = clampNumber(actualDurationMinutes, 0);
  const planned = clampNumber(plannedDurationMinutes, 0);

  if (planned <= 0) {
    return actual > 0 ? 100 : 0;
  }

  return Math.min(100, Math.round((actual / planned) * 100));
};

const analyzeDistraction = ({
  actualDurationMinutes = 0,
  plannedDurationMinutes = 0,
  pauseCount = 0,
  totalPausedMinutes = 0,
  appSwitchCount = 0,
}) => {
  const actual = clampNumber(actualDurationMinutes, 0);
  const planned = clampNumber(plannedDurationMinutes, 0);
  const pauses = clampNumber(pauseCount, 0);
  const pausedMinutes = clampNumber(totalPausedMinutes, 0);
  const appSwitches = clampNumber(appSwitchCount, 0);
  const completionRatio = planned > 0 ? actual / planned : actual > 0 ? 1 : 0;
  const shortfallMinutes = planned > 0 ? Math.max(0, planned - actual) : 0;
  const stoppedEarly = planned > 0 && shortfallMinutes >= EARLY_EXIT_BUFFER_MINUTES;
  const lowCompletion = planned > 0 && completionRatio < LOW_COMPLETION_RATIO;
  const frequentPauses = pauses >= FREQUENT_PAUSE_THRESHOLD;
  const frequentSwitching = appSwitches >= FREQUENT_APP_SWITCH_THRESHOLD;
  const distractionFlags = [];

  if (stoppedEarly) {
    distractionFlags.push('stopped-early');
  }

  if (lowCompletion) {
    distractionFlags.push('low-completion');
  }

  if (frequentPauses) {
    distractionFlags.push('frequent-pauses');
  }

  if (frequentSwitching) {
    distractionFlags.push('frequent-switches');
  }

  const pausePenaltyMinutes = frequentPauses ? pausedMinutes : 0;
  const switchPenaltyMinutes = frequentSwitching ? Math.min(20, Math.max(0, appSwitches - 2) * 2) : 0;
  const distractionDetected = distractionFlags.length > 0;
  const distractionTimeMinutes = distractionDetected
    ? roundToWholeMinutes(Math.max(shortfallMinutes, pausePenaltyMinutes) + switchPenaltyMinutes)
    : 0;
  const productivityScore = calculateProductivityScore({
    actualDurationMinutes: actual,
    plannedDurationMinutes: planned,
  });

  return {
    actualDurationMinutes: roundToWholeMinutes(actual),
    plannedDurationMinutes: roundToWholeMinutes(planned),
    completionRatio,
    shortfallMinutes: roundToWholeMinutes(shortfallMinutes),
    distractionDetected,
    distractionFlags,
    distractionTimeMinutes,
    productivityScore,
    productivityLabel: getProductivityLabel(productivityScore),
  };
};

const getSuggestedPlannedDurationMinutes = (task) => {
  const expectedStudyMinutes = clampNumber(task?.expectedStudyMinutes, 0);

  if (expectedStudyMinutes <= 0) {
    return DEFAULT_PLANNED_DURATION_MINUTES;
  }

  if (expectedStudyMinutes <= MAX_PLANNED_DURATION_MINUTES) {
    return sanitizePlannedDurationMinutes(expectedStudyMinutes);
  }

  return 90;
};

module.exports = {
  DISTRACTION_TAGS,
  DEFAULT_PLANNED_DURATION_MINUTES,
  MIN_PLANNED_DURATION_MINUTES,
  MAX_PLANNED_DURATION_MINUTES,
  FREQUENT_PAUSE_THRESHOLD,
  FREQUENT_APP_SWITCH_THRESHOLD,
  LOW_COMPLETION_RATIO,
  normalizeDistractionTag,
  sanitizePlannedDurationMinutes,
  analyzeDistraction,
  calculateProductivityScore,
  getProductivityLabel,
  getSuggestedPlannedDurationMinutes,
};
