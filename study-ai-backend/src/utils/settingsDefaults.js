const DEFAULT_SETTINGS = {
  userId: 'default',
  profile: {
    name: 'Deep Focus',
    avatar: 'DF',
    bio: 'Student workspace',
  },
  appearance: {
    theme: 'dark',
  },
  notifications: {
    enabled: true,
    dailyReminder: true,
    reminderTime: '09:00',
  },
  studyPreferences: {
    defaultSessionMinutes: 45,
    breakMinutes: 10,
    weeklyGoalMinutes: 300,
  },
  focusMode: {
    enabled: false,
    autoStart: true,
    sound: false,
    strictMode: true,
  },
  analytics: {
    showStats: true,
  },
  language: 'en',
};

const VALID_THEMES = new Set(['light', 'dark', 'system']);
const VALID_LANGUAGES = new Set(['en', 'hi']);
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const deepMerge = (base, overrides) => {
  if (!isPlainObject(base)) {
    return overrides;
  }

  if (!isPlainObject(overrides)) {
    return overrides === undefined ? base : overrides;
  }

  const merged = { ...base };

  Object.entries(overrides).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    merged[key] = isPlainObject(value) && isPlainObject(base[key]) ? deepMerge(base[key], value) : value;
  });

  return merged;
};

const clampNumber = (value, fallback, minimum, maximum) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
};

const normalizeShortText = (value, fallback, maximumLength) => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim();
  if (!normalized) {
    return fallback;
  }

  return normalized.slice(0, maximumLength);
};

const normalizeOptionalText = (value, maximumLength) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, maximumLength);
};

const normalizeReminderTime = (value, fallback) => {
  if (typeof value !== 'string') {
    return fallback;
  }

  return TIME_PATTERN.test(value.trim()) ? value.trim() : fallback;
};

const normalizeSettings = (input = {}) => {
  const merged = deepMerge(DEFAULT_SETTINGS, input);

  return {
    userId: normalizeShortText(merged.userId, DEFAULT_SETTINGS.userId, 120),
    profile: {
      name: normalizeShortText(merged.profile?.name, DEFAULT_SETTINGS.profile.name, 80),
      avatar: normalizeShortText(merged.profile?.avatar, DEFAULT_SETTINGS.profile.avatar, 8),
      bio: normalizeOptionalText(merged.profile?.bio, 160),
    },
    appearance: {
      theme: VALID_THEMES.has(merged.appearance?.theme) ? merged.appearance.theme : DEFAULT_SETTINGS.appearance.theme,
    },
    notifications: {
      enabled: Boolean(merged.notifications?.enabled),
      dailyReminder: Boolean(merged.notifications?.dailyReminder),
      reminderTime: normalizeReminderTime(
        merged.notifications?.reminderTime,
        DEFAULT_SETTINGS.notifications.reminderTime,
      ),
    },
    studyPreferences: {
      defaultSessionMinutes: clampNumber(
        merged.studyPreferences?.defaultSessionMinutes,
        DEFAULT_SETTINGS.studyPreferences.defaultSessionMinutes,
        5,
        240,
      ),
      breakMinutes: clampNumber(
        merged.studyPreferences?.breakMinutes,
        DEFAULT_SETTINGS.studyPreferences.breakMinutes,
        1,
        60,
      ),
      weeklyGoalMinutes: clampNumber(
        merged.studyPreferences?.weeklyGoalMinutes,
        DEFAULT_SETTINGS.studyPreferences.weeklyGoalMinutes,
        0,
        5000,
      ),
    },
    focusMode: {
      enabled: Boolean(merged.focusMode?.enabled),
      autoStart: Boolean(merged.focusMode?.autoStart),
      sound: Boolean(merged.focusMode?.sound),
      strictMode: Boolean(merged.focusMode?.strictMode),
    },
    analytics: {
      showStats: Boolean(merged.analytics?.showStats),
    },
    language: VALID_LANGUAGES.has(merged.language) ? merged.language : DEFAULT_SETTINGS.language,
  };
};

module.exports = {
  DEFAULT_SETTINGS,
  deepMerge,
  normalizeSettings,
};
