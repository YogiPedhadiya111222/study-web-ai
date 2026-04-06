'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getSettings, saveSettings, type SettingsResponse } from '@/lib/settingsApi';
import {
  SETTINGS_SAVE_DELAY_MS,
  applyDocumentSettings,
  areSettingsEqual,
  DEFAULT_SETTINGS,
  deepMerge,
  normalizeSettings,
  readStoredSettings,
  writeStoredSettings,
  type AppSettings,
  type PartialAppSettings,
} from '@/lib/settings';

type SettingsSyncStatus = 'loading' | 'ready' | 'saving' | 'saved' | 'error';

interface ApplySettingsOptions {
  skipSync?: boolean;
  updatedAt?: string | null;
  successMessage?: string | null;
}

interface SettingsContextValue {
  settings: AppSettings;
  syncStatus: SettingsSyncStatus;
  isHydrated: boolean;
  isSaving: boolean;
  errorMessage: string | null;
  successMessage: string | null;
  lastSavedAt: string | null;
  updateSettings: (updates: PartialAppSettings) => void;
  applySettings: (settings: AppSettings, options?: ApplySettingsOptions) => void;
  refreshSettings: () => Promise<SettingsResponse | null>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const normalizeServerPayload = (response: SettingsResponse) => normalizeSettings(response);

export default function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [syncStatus, setSyncStatus] = useState<SettingsSyncStatus>('loading');
  const [isHydrated, setIsHydrated] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const autoSyncReadyRef = useRef(false);
  const skipNextSyncRef = useRef(false);
  const requestIdRef = useRef(0);

  const applySettings = useCallback((nextSettings: AppSettings, options: ApplySettingsOptions = {}) => {
    if (options.skipSync) {
      skipNextSyncRef.current = true;
    }

    setSettings(normalizeSettings(nextSettings));
    setLastSavedAt(options.updatedAt ?? null);
    if (options.successMessage !== undefined) {
      setSuccessMessage(options.successMessage);
    }
    setErrorMessage(null);
    setSyncStatus(options.updatedAt ? 'saved' : 'ready');
  }, []);

  const refreshSettings = useCallback(async () => {
    try {
      const serverSettings = await getSettings();
      applySettings(normalizeServerPayload(serverSettings), {
        skipSync: true,
        updatedAt: serverSettings.updatedAt ?? null,
      });
      return serverSettings;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refresh settings.';
      setErrorMessage(message);
      setSyncStatus('error');
      return null;
    }
  }, [applySettings]);

  const updateSettings = useCallback((updates: PartialAppSettings) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setSettings((currentSettings) => normalizeSettings(deepMerge(currentSettings, updates)));
  }, []);

  useEffect(() => {
    applyDocumentSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (settings.appearance.theme !== 'system' || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      applyDocumentSettings(settings);
    };

    handleChange();

    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [settings]);

  useEffect(() => {
    writeStoredSettings({
      settings,
      updatedAt: lastSavedAt,
    });
  }, [lastSavedAt, settings]);

  useEffect(() => {
    let cancelled = false;
    const storedSnapshot = readStoredSettings();

    if (storedSnapshot) {
      skipNextSyncRef.current = true;
      setSettings(storedSnapshot.settings);
      setLastSavedAt(storedSnapshot.updatedAt);
      setSyncStatus(storedSnapshot.updatedAt ? 'saved' : 'ready');
    } else {
      applyDocumentSettings(DEFAULT_SETTINGS);
    }

    setIsHydrated(true);

    const restoreFromServer = async () => {
      try {
        const serverSettings = await getSettings();
        if (cancelled) {
          return;
        }

        const normalizedServerSettings = normalizeServerPayload(serverSettings);
        const localSettings = storedSnapshot?.settings ?? null;
        const localTimestamp = storedSnapshot?.updatedAt ? new Date(storedSnapshot.updatedAt).getTime() : 0;
        const serverTimestamp = serverSettings.updatedAt ? new Date(serverSettings.updatedAt).getTime() : 0;

        if (!localSettings || serverTimestamp > localTimestamp) {
          applySettings(normalizedServerSettings, {
            skipSync: true,
            updatedAt: serverSettings.updatedAt ?? null,
          });
        } else if (areSettingsEqual(localSettings, normalizedServerSettings)) {
          skipNextSyncRef.current = true;
          setSyncStatus(serverSettings.updatedAt ? 'saved' : 'ready');
        } else {
          setSyncStatus('ready');
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        skipNextSyncRef.current = true;
        const message = error instanceof Error ? error.message : 'Failed to load settings.';
        setErrorMessage(storedSnapshot ? null : message);
        setSyncStatus(storedSnapshot ? 'ready' : 'error');
      } finally {
        if (!cancelled) {
          autoSyncReadyRef.current = true;
        }
      }
    };

    void restoreFromServer();

    return () => {
      cancelled = true;
    };
  }, [applySettings]);

  useEffect(() => {
    if (!autoSyncReadyRef.current) {
      return;
    }

    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }

    setSyncStatus('saving');
    const requestId = ++requestIdRef.current;
    const timeout = window.setTimeout(async () => {
      try {
        const response = await saveSettings(settings);
        if (requestIdRef.current !== requestId) {
          return;
        }

        applySettings(normalizeServerPayload(response.settings), {
          skipSync: true,
          updatedAt: response.settings.updatedAt ?? new Date().toISOString(),
          successMessage: response.message,
        });
      } catch (error) {
        if (requestIdRef.current !== requestId) {
          return;
        }

        setSyncStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Failed to save settings.');
      }
    }, SETTINGS_SAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [applySettings, settings]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setSuccessMessage(null);
    }, 3200);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [successMessage]);

  const contextValue = useMemo<SettingsContextValue>(
    () => ({
      settings,
      syncStatus,
      isHydrated,
      isSaving: syncStatus === 'saving',
      errorMessage,
      successMessage,
      lastSavedAt,
      updateSettings,
      applySettings,
      refreshSettings,
    }),
    [applySettings, errorMessage, isHydrated, lastSavedAt, refreshSettings, settings, successMessage, syncStatus, updateSettings],
  );

  return <SettingsContext.Provider value={contextValue}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);

  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider.');
  }

  return context;
}
