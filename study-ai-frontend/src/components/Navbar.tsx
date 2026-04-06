'use client';

import { useSettings } from '@/components/SettingsProvider';
import GlobalSearch from '@/components/GlobalSearch';
import { Bell, BellOff, Menu, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface NavbarProps {
  onMenuClick: () => void;
}

export default function Navbar({ onMenuClick }: NavbarProps) {
  const { settings, updateSettings } = useSettings();
  const avatarLabel = settings.profile.avatar || settings.profile.name.slice(0, 2).toUpperCase();
  const subtitle = settings.profile.bio || 'Student workspace';

  return (
    <nav
      className="surface-overlay sticky top-0 z-30 border-b px-3 py-3 backdrop-blur-2xl sm:px-6 sm:py-4 lg:pl-[20rem] lg:pr-8"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <button
            onClick={onMenuClick}
            className="surface-card-soft text-secondary rounded-2xl p-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-400/30 sm:p-3 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="rounded-2xl bg-[linear-gradient(135deg,#38bdf8_0%,#818cf8_55%,#34d399_100%)] p-2 text-slate-950 shadow-lg shadow-sky-500/20">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-primary text-base font-semibold tracking-tight sm:text-lg">StudyAI</p>
                <p className="text-muted hidden text-xs uppercase tracking-[0.22em] sm:block">Focus Operating System</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:gap-3">
          <GlobalSearch />
          <button
            type="button"
            onClick={() => updateSettings({ notifications: { enabled: !settings.notifications.enabled } })}
            aria-pressed={settings.notifications.enabled}
            className={`surface-card-soft rounded-2xl p-2.5 transition-all duration-300 hover:-translate-y-0.5 sm:p-3 ${
              settings.notifications.enabled ? 'text-secondary hover:border-sky-400/25' : 'text-muted hover:border-rose-400/25'
            }`}
            title={settings.notifications.enabled ? 'Disable notifications' : 'Enable notifications'}
          >
            {settings.notifications.enabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
          </button>
          <Link
            href="/settings"
            className="surface-card-soft inline-flex items-center gap-2 rounded-2xl px-2.5 py-2 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-400/25 sm:gap-3 sm:px-3 sm:py-2.5"
          >
            <div className="rounded-xl bg-[linear-gradient(135deg,#38bdf8_0%,#818cf8_55%,#34d399_100%)] px-2.5 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-500/15">
              {avatarLabel}
            </div>
            <div className="hidden sm:block">
              <p className="text-primary text-sm font-medium">{settings.profile.name}</p>
              <p className="text-tertiary text-xs">{subtitle}</p>
            </div>
          </Link>
        </div>
      </div>
    </nav>
  );
}
