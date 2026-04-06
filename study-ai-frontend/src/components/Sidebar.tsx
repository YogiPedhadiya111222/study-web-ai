'use client';

import { BarChart3, BookOpen, Home, Settings, Target, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const menuItems = [
  { icon: Home, label: 'Dashboard', href: '/' },
  { icon: BookOpen, label: 'Tasks', href: '/tasks' },
  { icon: BarChart3, label: 'Analytics', href: '/analytics' },
  { icon: Target, label: 'Sessions', href: '/sessions' },
  { icon: Settings, label: 'Settings', href: '/settings' },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {isOpen && (
        <div
          className="surface-overlay fixed inset-0 z-40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`surface-card-strong fixed left-0 top-0 z-50 h-full w-[min(18rem,calc(100vw-1rem))] max-w-72 overflow-y-auto border-r px-4 pb-5 pt-4 transition-transform duration-300 ease-in-out sm:px-5 sm:pb-6 sm:pt-5 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-center justify-between border-b pb-5" style={{ borderColor: 'var(--border)' }}>
          <div>
            <p className="text-primary text-lg font-semibold tracking-tight">Workspace</p>
            <p className="text-tertiary text-sm">Your study control center</p>
          </div>
          <button
            onClick={onClose}
            className="surface-card-soft text-secondary rounded-2xl p-2 transition-colors hover:border-sky-400/25 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(56,189,248,0.16),rgba(129,140,248,0.08),rgba(15,23,42,0.62))] p-4">
          <p className="text-secondary text-xs uppercase tracking-[0.22em]">Today</p>
          <p className="text-primary mt-3 text-2xl font-semibold tracking-tight">Build momentum</p>
          <p className="text-secondary mt-2 text-sm leading-6">
            Keep your dashboard, tasks, and sessions in one focused flow.
          </p>
        </div>

        <nav className="mt-6">
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-300 ${
                    pathname === item.href
                      ? 'border border-sky-400/25 bg-sky-500/14 text-[var(--foreground)] shadow-[0_18px_50px_rgba(14,165,233,0.12)]'
                      : 'border border-transparent text-[var(--text-secondary)] hover:border-[var(--border)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]'
                  }`}
                  onClick={onClose}
                >
                  <span
                    className={`rounded-xl p-2 transition-colors ${
                      pathname === item.href
                        ? 'bg-[var(--surface-soft)] text-sky-200'
                        : 'bg-[var(--surface-soft)] text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]'
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                  </span>
                  <span className="font-medium">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="surface-card-soft mt-6 rounded-3xl p-4">
          <p className="text-primary text-sm font-medium">Navigation tip</p>
          <p className="text-tertiary mt-2 text-sm leading-6">
            Use Tasks to launch focused work blocks, then review patterns in Analytics.
          </p>
        </div>
      </aside>
    </>
  );
}
