'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import AppShell from '@/components/AppShell';
import ChartSection from '@/components/ChartSection';
import DashboardCard from '@/components/DashboardCard';
import LiveClock from '@/components/LiveClock';
import { useSettings } from '@/components/SettingsProvider';
import { fetchJson } from '@/lib/api';
import { formatMinutes, formatPercent } from '@/lib/format';
import Link from 'next/link';
import { BrainCircuit, CalendarRange, CheckCircle2, Sparkles, TimerReset } from 'lucide-react';

const ProductivityRings = dynamic(() => import('@/components/ProductivityRings'), {
  loading: () => <div className="h-[320px] animate-pulse rounded-[30px] border border-white/10 bg-white/5" />,
});
const StudyChart = dynamic(() => import('@/components/StudyChart'), {
  loading: () => <div className="h-[420px] animate-pulse rounded-[30px] border border-white/10 bg-white/5" />,
});
const TaskList = dynamic(() => import('@/components/TaskListRealtime'), {
  loading: () => <div className="h-[360px] animate-pulse rounded-[30px] border border-white/10 bg-white/5" />,
});
const Recommendations = dynamic(() => import('@/components/Recommendations'), {
  loading: () => <div className="h-[420px] animate-pulse rounded-[30px] border border-white/10 bg-white/5" />,
});

interface DashboardData {
  totalStudyMinutes: number;
  todayStudyMinutes: number;
  totalTasks: number;
  completedTasks: number;
  activeDays: number;
  totalDays: number;
  consistencyPercentage: number;
  avgStudyTime: number;
  weakSubjects: Array<{ subject: string; weaknessScore: number }>;
  productivity: {
    totalActivityTime: number;
    productiveTime: number;
    unproductiveTime: number;
    productivityScore: number;
    suggestions: string[];
  };
}

const EMPTY_DASHBOARD_DATA: DashboardData = {
  totalStudyMinutes: 0,
  todayStudyMinutes: 0,
  totalTasks: 0,
  completedTasks: 0,
  activeDays: 0,
  totalDays: 0,
  consistencyPercentage: 0,
  avgStudyTime: 0,
  weakSubjects: [],
  productivity: {
    totalActivityTime: 0,
    productiveTime: 0,
    unproductiveTime: 0,
    productivityScore: 0,
    suggestions: ['Start a study session to get recommendations'],
  },
};

const DASHBOARD_FALLBACK_SUBJECT = [{ subject: 'No subject data yet', weaknessScore: 0 }];

export default function Dashboard() {
  const { settings } = useSettings();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    if (!settings.analytics.showStats) {
      setDashboardData(EMPTY_DASHBOARD_DATA);
      setLoading(false);
      return;
    }

    try {
      const data = await fetchJson<DashboardData>('/dashboard');
      setDashboardData(data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setDashboardData(EMPTY_DASHBOARD_DATA);
    } finally {
      setLoading(false);
    }
  }, [settings.analytics.showStats]);

  useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  const dashboardSnapshot = dashboardData ?? EMPTY_DASHBOARD_DATA;
  const completionRate = useMemo(
    () => (dashboardSnapshot.totalTasks ? (dashboardSnapshot.completedTasks / dashboardSnapshot.totalTasks) * 100 : 0),
    [dashboardSnapshot.completedTasks, dashboardSnapshot.totalTasks],
  );
  const weakSubjects = useMemo(
    () => (dashboardSnapshot.weakSubjects.length ? dashboardSnapshot.weakSubjects : DASHBOARD_FALLBACK_SUBJECT),
    [dashboardSnapshot.weakSubjects],
  );
  const highlights = useMemo(
    () => [
      {
        title: 'Duration',
        value: formatMinutes(dashboardSnapshot.totalStudyMinutes),
        description: 'Combined time from completed sessions.',
        icon: <TimerReset className="h-5 w-5" />,
        accent: 'blue' as const,
        eyebrow: 'Tracked time',
      },
      {
        title: 'Today',
        value: formatMinutes(dashboardSnapshot.todayStudyMinutes),
        description: 'Completed session time recorded today.',
        icon: <CheckCircle2 className="h-5 w-5" />,
        accent: 'emerald' as const,
        eyebrow: 'Today tracked',
      },
      {
        title: 'Task completion',
        value: formatPercent(completionRate),
        description: `${dashboardSnapshot.completedTasks} of ${dashboardSnapshot.totalTasks} tasks finished.`,
        icon: <CheckCircle2 className="h-5 w-5" />,
        accent: 'amber' as const,
        eyebrow: 'Execution',
      },
      {
        title: 'Consistency',
        value: formatPercent(dashboardSnapshot.consistencyPercentage),
        description: `${dashboardSnapshot.activeDays} active days across ${dashboardSnapshot.totalDays} tracked days.`,
        icon: <CalendarRange className="h-5 w-5" />,
        accent: 'violet' as const,
        eyebrow: 'Rhythm',
      },
    ],
    [
      completionRate,
      dashboardSnapshot.activeDays,
      dashboardSnapshot.consistencyPercentage,
      dashboardSnapshot.completedTasks,
      dashboardSnapshot.todayStudyMinutes,
      dashboardSnapshot.totalDays,
      dashboardSnapshot.totalStudyMinutes,
      dashboardSnapshot.totalTasks,
    ],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-16 w-16 animate-spin rounded-full border-2 border-sky-400/20 border-t-sky-300" />
          <p className="text-muted text-sm uppercase tracking-[0.22em]">Loading dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="space-y-5 sm:space-y-6">
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
          <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(145deg,rgba(14,165,233,0.16),rgba(129,140,248,0.14),rgba(15,23,42,0.8))] p-5 shadow-[0_30px_100px_rgba(2,6,23,0.45)] backdrop-blur-2xl sm:p-8">
            <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-sky-400/12 blur-3xl" />
            <div className="relative max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs text-slate-200 sm:text-sm">
                <Sparkles className="h-4 w-4 text-sky-300" />
                Productivity overview
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl xl:text-5xl">
                {settings.profile.name.split(' ')[0]}, your study dashboard is ready for fast scanning and better focus.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
                Keep the most important signals visible in under five seconds: study time, productivity, task progress, and today&apos;s next-best actions.
              </p>
              <p className="mt-3 text-sm text-slate-200/80">
                Weekly goal: {formatMinutes(settings.studyPreferences.weeklyGoalMinutes)}. Theme: {settings.appearance.theme}.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href="/sessions"
                  className="w-full rounded-2xl border border-sky-300/20 bg-sky-400/15 px-5 py-3 text-center font-medium text-sky-100 transition-all duration-300 hover:-translate-y-0.5 hover:bg-sky-400/25 sm:w-auto"
                >
                  Start focus block
                </Link>
                <Link
                  href="/analytics"
                  className="w-full rounded-2xl border border-white/10 bg-white/8 px-5 py-3 text-center font-medium text-slate-100 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/12 sm:w-auto"
                >
                  Review analytics
                </Link>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <LiveClock />

            <ChartSection
              title="Priority Snapshot"
              description="Top subjects and productivity signals that need your attention next."
              action={<BrainCircuit className="h-5 w-5 text-violet-200" />}
            >
              <div className="space-y-3">
                {weakSubjects.map((subject) => (
                  <div key={subject.subject} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">{subject.subject}</p>
                        <p className="mt-1 text-sm text-slate-400">Weakness signal based on tests and study time.</p>
                      </div>
                      <span className="self-start rounded-full border border-rose-400/20 bg-rose-500/15 px-3 py-1 text-sm font-medium text-rose-100 sm:self-auto">
                        {formatPercent(subject.weaknessScore)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ChartSection>
          </div>
        </section>

        {settings.analytics.showStats ? (
          <>
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {highlights.map((card) => (
                <DashboardCard
                  key={card.title}
                  title={card.title}
                  value={card.value}
                  description={card.description}
                  icon={card.icon}
                  accent={card.accent}
                  eyebrow={card.eyebrow}
                />
              ))}
            </section>

            <ProductivityRings data={dashboardSnapshot} />

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <StudyChart data={dashboardSnapshot.productivity} />
              <Recommendations suggestions={dashboardSnapshot.productivity.suggestions} />
            </div>
          </>
        ) : (
          <ChartSection
            title="Analytics Hidden"
            description="Stats are currently hidden from the dashboard by your analytics preference."
          >
            <div className="surface-card-soft rounded-3xl p-5">
              <p className="text-primary text-lg font-medium">Dashboard stats are off right now.</p>
              <p className="text-tertiary mt-2 text-sm leading-6">
                Turn analytics back on in Settings whenever you want the cards, charts, and AI recommendations to return.
              </p>
              <Link
                href="/settings"
                className="mt-4 inline-flex rounded-2xl border border-sky-400/20 bg-sky-500/12 px-4 py-3 text-sm font-medium text-sky-100 transition-all duration-300 hover:-translate-y-0.5 hover:bg-sky-500/20"
              >
                Open settings
              </Link>
            </div>
          </ChartSection>
        )}

        <TaskList onTaskUpdate={settings.analytics.showStats ? fetchDashboardData : () => {}} />
      </div>
    </AppShell>
  );
}
