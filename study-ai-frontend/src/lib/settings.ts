export type ThemeMode = 'light' | 'dark' | 'system';
export type LanguageCode = 'en' | 'hi';

export interface AppSettings {
  profile: {
    name: string;
    avatar: string;
    bio: string;
  };
  appearance: {
    theme: ThemeMode;
  };
  notifications: {
    enabled: boolean;
    dailyReminder: boolean;
    reminderTime: string;
  };
  studyPreferences: {
    defaultSessionMinutes: number;
    breakMinutes: number;
    weeklyGoalMinutes: number;
  };
  focusMode: {
    enabled: boolean;
    autoStart: boolean;
    sound: boolean;
    strictMode: boolean;
  };
  analytics: {
    showStats: boolean;
  };
  language: LanguageCode;
}

export type PartialAppSettings = {
  [K in keyof AppSettings]?: AppSettings[K] extends object ? Partial<AppSettings[K]> : AppSettings[K];
};

export interface StoredSettingsSnapshot {
  settings: AppSettings;
  updatedAt: string | null;
}

export const SETTINGS_STORAGE_KEY = 'study-ai-settings';
export const SETTINGS_SAVE_DELAY_MS = 600;

export const DEFAULT_SETTINGS: AppSettings = {
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

const VALID_THEMES = new Set<ThemeMode>(['light', 'dark', 'system']);
const VALID_LANGUAGES = new Set<LanguageCode>(['en', 'hi']);
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export function deepMerge<T>(base: T, overrides?: unknown): T {
  if (!isPlainObject(base)) {
    return (overrides === undefined ? base : overrides) as T;
  }

  if (!isPlainObject(overrides)) {
    return (overrides === undefined ? base : overrides) as T;
  }

  const merged = { ...base } as Record<string, unknown>;

  Object.entries(overrides).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    const currentValue = merged[key];
    merged[key] = isPlainObject(currentValue) && isPlainObject(value) ? deepMerge(currentValue, value) : value;
  });

  return merged as T;
}

const clampNumber = (value: unknown, fallback: number, minimum: number, maximum: number) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
};

const normalizeShortText = (value: unknown, fallback: string, maximumLength: number) => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim();
  if (!normalized) {
    return fallback;
  }

  return normalized.slice(0, maximumLength);
};

const normalizeOptionalText = (value: unknown, maximumLength: number) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, maximumLength);
};

const normalizeReminderTime = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim();
  return TIME_PATTERN.test(normalized) ? normalized : fallback;
};

export function normalizeSettings(input?: unknown): AppSettings {
  const merged = deepMerge(DEFAULT_SETTINGS, input);

  return {
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
      reminderTime: normalizeReminderTime(merged.notifications?.reminderTime, DEFAULT_SETTINGS.notifications.reminderTime),
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
}

export function areSettingsEqual(left?: unknown, right?: unknown) {
  return JSON.stringify(normalizeSettings(left)) === JSON.stringify(normalizeSettings(right));
}

export function getResolvedTheme(themePreference: ThemeMode) {
  if (themePreference !== 'system') {
    return themePreference;
  }

  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'dark';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyDocumentSettings(settings: Pick<AppSettings, 'appearance' | 'language'>) {
  if (typeof document === 'undefined') {
    return;
  }

  const resolvedTheme = getResolvedTheme(settings.appearance.theme);
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.themePreference = settings.appearance.theme;
  document.documentElement.lang = settings.language;
  document.documentElement.style.colorScheme = resolvedTheme;
}

export function readStoredSettings() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const storedValue = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!storedValue) {
      return null;
    }

    const parsed = JSON.parse(storedValue) as Partial<StoredSettingsSnapshot> | AppSettings;
    if ('settings' in parsed && parsed.settings) {
      return {
        settings: normalizeSettings(parsed.settings),
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
      } satisfies StoredSettingsSnapshot;
    }

    return {
      settings: normalizeSettings(parsed),
      updatedAt: null,
    } satisfies StoredSettingsSnapshot;
  } catch {
    return null;
  }
}

export function writeStoredSettings(snapshot: StoredSettingsSnapshot) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        settings: normalizeSettings(snapshot.settings),
        updatedAt: snapshot.updatedAt,
      } satisfies StoredSettingsSnapshot),
    );
  } catch {
    // Ignore local storage write failures and keep the in-memory state live.
  }
}
