'use client';

import { useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import ChartSection from '@/components/ChartSection';
import { useSettings } from '@/components/SettingsProvider';
import { clearAppData, exportAppData, resetSettings } from '@/lib/settingsApi';
import { Download, Loader2, RotateCcw, Trash2 } from 'lucide-react';

type ActionState = 'export' | 'reset' | 'clear' | null;

const parseNumber = (value: string, fallback: number) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export default function SettingsPage() {
  const { settings, updateSettings, applySettings, syncStatus, isHydrated, errorMessage, successMessage, lastSavedAt } =
    useSettings();
  const [actionState, setActionState] = useState<ActionState>(null);
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const syncLabel = useMemo(() => {
    if (syncStatus === 'saving') return 'Saving changes...';
    if (syncStatus === 'error') return 'Sync issue';
    if (lastSavedAt) {
      return `Saved at ${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return 'Changes sync automatically';
  }, [lastSavedAt, syncStatus]);

  const handleExport = async () => {
    setActionState('export');
    setPageMessage(null);
    setPageError(null);
    try {
      const payload = await exportAppData();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `study-ai-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setPageMessage('Export downloaded successfully.');
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Failed to export data.');
    } finally {
      setActionState(null);
    }
  };

  const handleReset = async () => {
    setActionState('reset');
    setPageMessage(null);
    setPageError(null);
    try {
      const response = await resetSettings();
      applySettings(response.settings, { skipSync: true, updatedAt: response.settings.updatedAt ?? null, successMessage: response.message });
      setPageMessage(response.message);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Failed to reset settings.');
    } finally {
      setActionState(null);
    }
  };

  const handleClear = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }

    setActionState('clear');
    setPageMessage(null);
    setPageError(null);
    try {
      const response = await clearAppData();
      applySettings(response.settings, { skipSync: true, updatedAt: response.settings.updatedAt ?? null, successMessage: response.message });
      setPageMessage(response.message);
      setConfirmClear(false);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Failed to clear app data.');
    } finally {
      setActionState(null);
    }
  };

  if (!isHydrated) {
    return (
      <AppShell>
        <div className="space-y-6">
          <div className="surface-card h-40 animate-pulse rounded-[30px]" />
          <div className="surface-card h-72 animate-pulse rounded-[30px]" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <ChartSection title="Settings" description="Every change applies instantly, syncs automatically, and persists across refreshes.">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-secondary mb-2 block text-sm font-medium">Display name</span>
                  <input type="text" value={settings.profile.name} onChange={(event) => updateSettings({ profile: { name: event.target.value } })} className="surface-input w-full rounded-2xl px-4 py-3 outline-none" maxLength={80} />
                </label>
                <label className="block">
                  <span className="text-secondary mb-2 block text-sm font-medium">Avatar badge</span>
                  <input type="text" value={settings.profile.avatar} onChange={(event) => updateSettings({ profile: { avatar: event.target.value.toUpperCase() } })} className="surface-input w-full rounded-2xl px-4 py-3 outline-none" maxLength={8} />
                </label>
              </div>
              <label className="block">
                <span className="text-secondary mb-2 block text-sm font-medium">Bio</span>
                <textarea value={settings.profile.bio} onChange={(event) => updateSettings({ profile: { bio: event.target.value } })} className="surface-input min-h-24 w-full rounded-2xl px-4 py-3 outline-none" maxLength={160} />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-secondary mb-2 block text-sm font-medium">Theme</span>
                  <select value={settings.appearance.theme} onChange={(event) => updateSettings({ appearance: { theme: event.target.value as 'light' | 'dark' | 'system' } })} className="surface-input w-full rounded-2xl px-4 py-3 outline-none">
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                    <option value="system">System</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-secondary mb-2 block text-sm font-medium">Language</span>
                  <select value={settings.language} onChange={(event) => updateSettings({ language: event.target.value as 'en' | 'hi' })} className="surface-input w-full rounded-2xl px-4 py-3 outline-none">
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="surface-card-soft rounded-[28px] p-5">
              <p className="text-muted text-xs uppercase tracking-[0.22em]">Sync status</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-primary text-lg font-medium">{syncLabel}</p>
                {(syncStatus === 'saving' || actionState) ? <Loader2 className="h-5 w-5 animate-spin text-sky-300" /> : null}
              </div>
              <div className="mt-5 rounded-[28px] border border-sky-400/20 bg-[linear-gradient(145deg,rgba(56,189,248,0.18),rgba(129,140,248,0.08),rgba(15,23,42,0.62))] p-5">
                <div className="flex items-center gap-4">
                  <div className="rounded-3xl bg-[linear-gradient(135deg,#38bdf8_0%,#818cf8_55%,#34d399_100%)] px-4 py-3 text-xl font-semibold text-slate-950">{settings.profile.avatar}</div>
                  <div>
                    <p className="text-primary font-medium">{settings.profile.name}</p>
                    <p className="text-secondary text-sm">{settings.profile.bio || 'Student workspace'}</p>
                  </div>
                </div>
              </div>
              {successMessage || pageMessage ? <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{successMessage ?? pageMessage}</div> : null}
              {errorMessage || pageError ? <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{errorMessage ?? pageError}</div> : null}
            </div>
          </div>
        </ChartSection>

        <div className="grid gap-6 xl:grid-cols-2">
          <ChartSection title="Preferences" description="Notifications, analytics visibility, focus mode, and reminders.">
            <div className="space-y-4">
              <label className="surface-card-soft flex items-center justify-between gap-4 rounded-3xl p-4">
                <div>
                  <p className="text-primary text-sm font-medium">Enable notifications</p>
                  <p className="text-tertiary mt-1 text-sm">Allow in-app reminders and focus alerts.</p>
                </div>
                <input type="checkbox" checked={settings.notifications.enabled} onChange={(event) => updateSettings({ notifications: { enabled: event.target.checked } })} className="h-5 w-5 accent-sky-400" />
              </label>
              <label className="surface-card-soft flex items-center justify-between gap-4 rounded-3xl p-4">
                <div>
                  <p className="text-primary text-sm font-medium">Daily reminder</p>
                  <p className="text-tertiary mt-1 text-sm">Keep a saved daily reminder time.</p>
                </div>
                <input type="checkbox" checked={settings.notifications.dailyReminder} onChange={(event) => updateSettings({ notifications: { dailyReminder: event.target.checked } })} className="h-5 w-5 accent-sky-400" />
              </label>
              <label className="block">
                <span className="text-secondary mb-2 block text-sm font-medium">Reminder time</span>
                <input type="time" value={settings.notifications.reminderTime} onChange={(event) => updateSettings({ notifications: { reminderTime: event.target.value } })} className="surface-input w-full rounded-2xl px-4 py-3 outline-none" />
              </label>
              <label className="surface-card-soft flex items-center justify-between gap-4 rounded-3xl p-4">
                <div>
                  <p className="text-primary text-sm font-medium">Show analytics stats</p>
                  <p className="text-tertiary mt-1 text-sm">Hide dashboard and analytics metrics when needed.</p>
                </div>
                <input type="checkbox" checked={settings.analytics.showStats} onChange={(event) => updateSettings({ analytics: { showStats: event.target.checked } })} className="h-5 w-5 accent-sky-400" />
              </label>
            </div>
          </ChartSection>

          <ChartSection title="Study Flow" description="Default timings and focus mode behavior for new sessions.">
            <div className="space-y-4">
              <label className="block">
                <span className="text-secondary mb-2 block text-sm font-medium">Default session time (minutes)</span>
                <input type="number" min={5} max={240} step={5} value={settings.studyPreferences.defaultSessionMinutes} onChange={(event) => updateSettings({ studyPreferences: { defaultSessionMinutes: parseNumber(event.target.value, settings.studyPreferences.defaultSessionMinutes) } })} className="surface-input w-full rounded-2xl px-4 py-3 outline-none" />
              </label>
              <label className="block">
                <span className="text-secondary mb-2 block text-sm font-medium">Break time (minutes)</span>
                <input type="number" min={1} max={60} value={settings.studyPreferences.breakMinutes} onChange={(event) => updateSettings({ studyPreferences: { breakMinutes: parseNumber(event.target.value, settings.studyPreferences.breakMinutes) } })} className="surface-input w-full rounded-2xl px-4 py-3 outline-none" />
              </label>
              <label className="block">
                <span className="text-secondary mb-2 block text-sm font-medium">Weekly study goal (minutes)</span>
                <input type="number" min={0} max={5000} step={15} value={settings.studyPreferences.weeklyGoalMinutes} onChange={(event) => updateSettings({ studyPreferences: { weeklyGoalMinutes: parseNumber(event.target.value, settings.studyPreferences.weeklyGoalMinutes) } })} className="surface-input w-full rounded-2xl px-4 py-3 outline-none" />
              </label>
              <label className="surface-card-soft flex items-center justify-between gap-4 rounded-3xl p-4">
                <div>
                  <p className="text-primary text-sm font-medium">Enable focus mode by default</p>
                  <p className="text-tertiary mt-1 text-sm">Sessions page opens with focus mode armed.</p>
                </div>
                <input type="checkbox" checked={settings.focusMode.enabled} onChange={(event) => updateSettings({ focusMode: { enabled: event.target.checked } })} className="h-5 w-5 accent-sky-400" />
              </label>
              <label className="surface-card-soft flex items-center justify-between gap-4 rounded-3xl p-4">
                <div>
                  <p className="text-primary text-sm font-medium">Auto-start restrictions</p>
                  <p className="text-tertiary mt-1 text-sm">Attempt fullscreen automatically on session start.</p>
                </div>
                <input type="checkbox" checked={settings.focusMode.autoStart} onChange={(event) => updateSettings({ focusMode: { autoStart: event.target.checked } })} className="h-5 w-5 accent-sky-400" />
              </label>
              <label className="surface-card-soft flex items-center justify-between gap-4 rounded-3xl p-4">
                <div>
                  <p className="text-primary text-sm font-medium">Focus sound cues</p>
                  <p className="text-tertiary mt-1 text-sm">Play short tones for alerts when notifications are enabled.</p>
                </div>
                <input type="checkbox" checked={settings.focusMode.sound} onChange={(event) => updateSettings({ focusMode: { sound: event.target.checked } })} className="h-5 w-5 accent-sky-400" />
              </label>
              <label className="surface-card-soft flex items-center justify-between gap-4 rounded-3xl p-4">
                <div>
                  <p className="text-primary text-sm font-medium">Strict focus restrictions</p>
                  <p className="text-tertiary mt-1 text-sm">Use stronger interruption alerts while focused.</p>
                </div>
                <input type="checkbox" checked={settings.focusMode.strictMode} onChange={(event) => updateSettings({ focusMode: { strictMode: event.target.checked } })} className="h-5 w-5 accent-sky-400" />
              </label>
            </div>
          </ChartSection>
        </div>

        <ChartSection title="Data Management" description="Export, reset, or clear data with working backend actions.">
          <div className="grid gap-4 lg:grid-cols-3">
            <button type="button" onClick={() => void handleExport()} disabled={actionState !== null} className="surface-card-soft rounded-[28px] p-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-400/20 disabled:cursor-not-allowed disabled:opacity-60">
              <Download className="h-5 w-5 text-sky-300" />
              <p className="text-primary mt-3 font-medium">Export data</p>
              <p className="text-tertiary mt-1 text-sm">Download tasks, sessions, activities, tests, and settings as JSON.</p>
            </button>
            <button type="button" onClick={() => void handleReset()} disabled={actionState !== null} className="surface-card-soft rounded-[28px] p-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-amber-400/20 disabled:cursor-not-allowed disabled:opacity-60">
              <RotateCcw className="h-5 w-5 text-amber-300" />
              <p className="text-primary mt-3 font-medium">Reset settings</p>
              <p className="text-tertiary mt-1 text-sm">Restore all settings to their default values.</p>
            </button>
            <button type="button" onClick={() => void handleClear()} disabled={actionState !== null} className={`rounded-[28px] border p-5 text-left transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 ${confirmClear ? 'border-rose-400/30 bg-rose-500/12' : 'surface-card-soft hover:-translate-y-0.5 hover:border-rose-400/20'}`}>
              <Trash2 className="h-5 w-5 text-rose-300" />
              <p className="text-primary mt-3 font-medium">{confirmClear ? 'Click again to confirm' : 'Clear all study data'}</p>
              <p className="text-tertiary mt-1 text-sm">Deletes tasks, sessions, activities, and tests, then restores default settings.</p>
            </button>
          </div>
        </ChartSection>
      </div>
    </AppShell>
  );
}
