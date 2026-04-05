const MINUTE_MS = 1000 * 60;

const roundMinutes = (ms) => Math.floor(ms / MINUTE_MS);

const getValidDate = (value = new Date()) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const getStoredPausedMs = (session) => {
  if (typeof session === 'number') {
    return Math.max(0, session);
  }

  if (typeof session?.totalPausedMs === 'number') {
    return Math.max(0, session.totalPausedMs);
  }

  return Math.max(0, (session?.totalPausedTime || 0) * MINUTE_MS);
};

const calcDurationMinutes = (startTime, endTime, pausedMs = 0) => {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;

  const pausedMsSafe = getStoredPausedMs(pausedMs);
  const durationMs = Math.max(0, end - start - pausedMsSafe);

  return roundMinutes(durationMs);
};

const getStoredDurationMinutes = (session) => {
  if (typeof session?.durationMinutes !== 'number') {
    return null;
  }

  return Math.max(0, session.durationMinutes);
};

const getSessionDurationMinutes = (session) => {
  const storedDuration = getStoredDurationMinutes(session);
  if (storedDuration !== null && storedDuration > 0) {
    return storedDuration;
  }

  if (!session?.startTime || !session?.endTime) {
    return storedDuration ?? 0;
  }

  const calculatedDuration = calcDurationMinutes(session.startTime, session.endTime, session);
  if (storedDuration === null) {
    return calculatedDuration;
  }

  return calculatedDuration > 0 ? calculatedDuration : storedDuration;
};

const toDayKey = (date = new Date()) => {
  const d = getValidDate(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDayRange = (date = new Date()) => {
  const d = getValidDate(date);
  const start = new Date(d);
  const end = new Date(d);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return {
    dayKey: toDayKey(d),
    start,
    end,
  };
};

const getRecentDaySequence = (days = 7, endDate = new Date()) => {
  const sequence = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = getValidDate(endDate);
    date.setDate(date.getDate() - offset);
    sequence.push({ date, dayKey: toDayKey(date) });
  }

  return sequence;
};

module.exports = {
  calcDurationMinutes,
  getSessionDurationMinutes,
  getStoredDurationMinutes,
  getStoredPausedMs,
  getDayRange,
  getRecentDaySequence,
  getUtcDayRange: getDayRange,
  toDayKey,
};
