'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import ChartSection from '@/components/ChartSection';
import DashboardCard from '@/components/DashboardCard';
import MonthlyStudySection, { type MonthlyStudyData } from '@/components/MonthlyStudySection';
import { useSettings } from '@/components/SettingsProvider';
import { fetchJson } from '@/lib/api';
import { formatDistractionTag } from '@/lib/distraction';
import { formatHours, formatMinutes, formatPercent } from '@/lib/format';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, BookCopy, BrainCircuit, TrendingUp } from 'lucide-react';

interface AnalyticsData {
  todayStudyMinutes: number;
  yesterdayStudyMinutes: number;
  weeklyStudyMinutes: number;
  monthlyStudy: MonthlyStudyData;
  weeklyData: Array<{
    day: string;
    date: string;
    studyTime: number;
    productivity: number;
    distractionTime: number;
    focusRatio: number;
  }>;
  subjectData: Array<{
    subject: string;
    timeMinutes: number;
    tasks: number;
  }>;
  distractionSummary: {
    periods: {
      today: {
        focusMinutes: number;
        distractionMinutes: number;
        focusRatio: number;
        productivityScore: number;
        sessions: number;
        distractedSessions: number;
      };
      week: {
        focusMinutes: number;
        distractionMinutes: number;
        focusRatio: number;
        productivityScore: number;
        sessions: number;
        distractedSessions: number;
      };
      month: {
        focusMinutes: number;
        distractionMinutes: number;
        focusRatio: number;
        productivityScore: number;
        sessions: number;
        distractedSessions: number;
      };
    };
    mostCommonDistraction: {
      tag: string;
      count: number;
      distractionMinutes: number;
    } | null;
    peakWindow: {
      label: string;
      startHour: number;
      distractionMinutes: number;
      sessionCount: number;
    } | null;
    tagBreakdown: Array<{
      tag: string;
      count: number;
      distractionMinutes: number;
    }>;
    scoreBreakdown: {
      excellent: number;
      good: number;
      needsImprovement: number;
    };
    weeklyChangePercent: number;
    weeklyDirection: 'up' | 'down' | 'flat';
    weeklyInsights: string[];
  };
  productivityTrend: Array<{
    date: string;
    score: number;
  }>;
  weeklyInsights: string[];
}

const COLORS = ['#38bdf8', '#34d399', '#f59e0b', '#fb7185', '#818cf8'];
const EMPTY_MONTHLY_STUDY: MonthlyStudyData = {
  totalMinutes: 0,
  averageDailyMinutes: 0,
  activeDays: 0,
  bestDay: null,
  dailyBreakdown: [],
  trend: {
    direction: 'flat',
    deltaMinutes: 0,
    percentChange: 0,
    previousTotalMinutes: 0,
  },
  streak: {
    currentDays: 0,
    longestDays: 0,
  },
};

const toNumber = (value: unknown) => (typeof value === 'number' ? value : Number(value ?? 0));
const parseDayKey = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) return null;

  const parsedDate = new Date(year, month - 1, day);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const formatTrendLabel = (value: string) => {
  const date = parseDayKey(value) ?? new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function AnalyticsPage() {
  const { settings } = useSettings();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!settings.analytics.showStats) {
      setAnalyticsData({
        todayStudyMinutes: 0,
        yesterdayStudyMinutes: 0,
        weeklyStudyMinutes: 0,
        monthlyStudy: EMPTY_MONTHLY_STUDY,
        weeklyData: [],
        subjectData: [],
        distractionSummary: {
          periods: {
            today: { focusMinutes: 0, distractionMinutes: 0, focusRatio: 0, productivityScore: 0, sessions: 0, distractedSessions: 0 },
            week: { focusMinutes: 0, distractionMinutes: 0, focusRatio: 0, productivityScore: 0, sessions: 0, distractedSessions: 0 },
            month: { focusMinutes: 0, distractionMinutes: 0, focusRatio: 0, productivityScore: 0, sessions: 0, distractedSessions: 0 },
          },
          mostCommonDistraction: null,
          peakWindow: null,
          tagBreakdown: [],
          scoreBreakdown: {
            excellent: 0,
            good: 0,
            needsImprovement: 0,
          },
          weeklyChangePercent: 0,
          weeklyDirection: 'flat',
          weeklyInsights: [],
        },
        productivityTrend: [],
        weeklyInsights: [],
      });
      setLoading(false);
      return;
    }

    const fetchAnalytics = async () => {
      try {
        const data = await fetchJson<AnalyticsData>('/analytics');
        setAnalyticsData(data);
      } catch (error) {
        console.error('Error fetching analytics:', error);
        setAnalyticsData({
          todayStudyMinutes: 0,
          yesterdayStudyMinutes: 0,
          weeklyStudyMinutes: 0,
          monthlyStudy: EMPTY_MONTHLY_STUDY,
          weeklyData: [],
          subjectData: [],
          distractionSummary: {
            periods: {
              today: { focusMinutes: 0, distractionMinutes: 0, focusRatio: 0, productivityScore: 0, sessions: 0, distractedSessions: 0 },
              week: { focusMinutes: 0, distractionMinutes: 0, focusRatio: 0, productivityScore: 0, sessions: 0, distractedSessions: 0 },
              month: { focusMinutes: 0, distractionMinutes: 0, focusRatio: 0, productivityScore: 0, sessions: 0, distractedSessions: 0 },
            },
            mostCommonDistraction: null,
            peakWindow: null,
            tagBreakdown: [],
            scoreBreakdown: {
              excellent: 0,
              good: 0,
              needsImprovement: 0,
            },
            weeklyChangePercent: 0,
            weeklyDirection: 'flat',
            weeklyInsights: [],
          },
          productivityTrend: [],
          weeklyInsights: [],
        });
      } finally {
        setLoading(false);
      }
    };

    void fetchAnalytics();
  }, [settings.analytics.showStats]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-[var(--foreground)]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-sky-400/20 border-t-sky-300" />
          <p className="text-muted text-sm uppercase tracking-[0.22em]">Loading analytics</p>
        </div>
      </div>
    );
  }

  const averageProductivity = analyticsData?.productivityTrend.length
    ? analyticsData.productivityTrend.reduce((sum, item) => sum + item.score, 0) / analyticsData.productivityTrend.length
    : 0;
  const topSubject = analyticsData?.subjectData.reduce(
    (best, current) => (current.timeMinutes > best.timeMinutes ? current : best),
    analyticsData?.subjectData[0] ?? { subject: 'No data', timeMinutes: 0, tasks: 0 },
  );
  const bestStudyDay = analyticsData?.weeklyData.reduce(
    (best, current) => (current.studyTime > best.studyTime ? current : best),
    analyticsData?.weeklyData[0] ?? { day: 'No data', date: '', studyTime: 0, productivity: 0, distractionTime: 0, focusRatio: 0 },
  );
  const todayStudyMinutes = analyticsData?.todayStudyMinutes ?? 0;
  const yesterdayStudyMinutes = analyticsData?.yesterdayStudyMinutes ?? 0;
  const todayDeltaMinutes = todayStudyMinutes - yesterdayStudyMinutes;
  const todayDeltaLabel =
    todayDeltaMinutes === 0
      ? 'matching yesterday'
      : todayDeltaMinutes > 0
        ? `${formatMinutes(todayDeltaMinutes)} more than yesterday`
        : `${formatMinutes(Math.abs(todayDeltaMinutes))} less than yesterday`;
  const distractionSummary = analyticsData?.distractionSummary;
  const weeklyFocusRatio = distractionSummary?.periods.week.focusRatio ?? 0;
  const weeklyDistractionMinutes = distractionSummary?.periods.week.distractionMinutes ?? 0;
  const monthlyDistractionMinutes = distractionSummary?.periods.month.distractionMinutes ?? 0;
  const todayDistractionMinutes = distractionSummary?.periods.today.distractionMinutes ?? 0;
  const mostCommonDistraction = distractionSummary?.mostCommonDistraction;
  const peakWindow = distractionSummary?.peakWindow;
  const weeklyInsights = analyticsData?.weeklyInsights ?? distractionSummary?.weeklyInsights ?? [];

  return (
    <AppShell>
      <div className="space-y-6">
        {!settings.analytics.showStats ? (
          <ChartSection
            title="Analytics Hidden"
            description="Your analytics preference is currently set to hide stats across the app."
          >
            <div className="surface-card-soft rounded-3xl p-6">
              <p className="text-primary text-lg font-medium">Analytics panels are turned off.</p>
              <p className="text-tertiary mt-2 text-sm leading-6">
                Re-enable analytics in Settings when you want to see study trends, subject distribution, and distraction insights again.
              </p>
              <Link
                href="/settings"
                className="mt-4 inline-flex rounded-2xl border border-sky-400/20 bg-sky-500/12 px-4 py-3 text-sm font-medium text-sky-100 transition-all duration-300 hover:-translate-y-0.5 hover:bg-sky-500/20"
              >
                Open settings
              </Link>
            </div>
          </ChartSection>
        ) : (
          <>
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-4">
          <DashboardCard
            title="Today tracked"
            value={formatMinutes(todayStudyMinutes)}
            description="Completed session time recorded today."
            icon={<Activity className="h-5 w-5" />}
            eyebrow="Today"
            accent="blue"
          />
          <DashboardCard
            title="Weekly distraction"
            value={formatMinutes(weeklyDistractionMinutes)}
            description="Estimated distraction time detected over the last seven days."
            icon={<TrendingUp className="h-5 w-5" />}
            eyebrow="Reduce"
            accent="emerald"
          />
          <DashboardCard
            title="Focus ratio"
            value={formatPercent(weeklyFocusRatio)}
            description="Focused time compared with distraction time this week."
            icon={<BookCopy className="h-5 w-5" />}
            eyebrow="Trend"
            accent="violet"
          />
          <DashboardCard
            title="Average productivity"
            value={formatPercent(averageProductivity)}
            description="Average score across the weekly productivity trend."
            icon={<BrainCircuit className="h-5 w-5" />}
            eyebrow="Focus"
            accent="amber"
          />
        </section>

        <MonthlyStudySection data={analyticsData?.monthlyStudy ?? EMPTY_MONTHLY_STUDY} />

        <ChartSection title="Distraction Manager" description="Track where focus is slipping, which distraction tags show up most, and when drift tends to happen.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-rose-400/15 bg-rose-500/10 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-rose-200/80">Today</p>
              <p className="mt-3 text-2xl font-semibold text-white">{formatMinutes(todayDistractionMinutes)}</p>
              <p className="mt-2 text-sm text-slate-300">Distraction time detected today.</p>
            </div>
            <div className="rounded-3xl border border-amber-400/15 bg-amber-500/10 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-amber-100/80">This Week</p>
              <p className="mt-3 text-2xl font-semibold text-white">{formatMinutes(weeklyDistractionMinutes)}</p>
              <p className="mt-2 text-sm text-slate-300">Lost focus time over the last seven days.</p>
            </div>
            <div className="rounded-3xl border border-sky-400/15 bg-sky-500/10 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-sky-100/80">This Month</p>
              <p className="mt-3 text-2xl font-semibold text-white">{formatMinutes(monthlyDistractionMinutes)}</p>
              <p className="mt-2 text-sm text-slate-300">Detected distraction time across the last 30 days.</p>
            </div>
            <div className="rounded-3xl border border-violet-400/15 bg-violet-500/10 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-violet-100/80">Top Tag</p>
              <p className="mt-3 text-2xl font-semibold text-white">
                {mostCommonDistraction ? formatDistractionTag(mostCommonDistraction.tag) : 'No data'}
              </p>
              <p className="mt-2 text-sm text-slate-300">
                {mostCommonDistraction
                  ? `${mostCommonDistraction.count} tagged session${mostCommonDistraction.count === 1 ? '' : 's'}.`
                  : 'Tag post-session distractions to build this pattern.'}
              </p>
            </div>
          </div>
        </ChartSection>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <ChartSection title="Weekly Study Time" description="Daily study volume across the last seven days from completed sessions.">
            <div className="h-72 rounded-3xl border border-white/10 bg-white/5 p-3 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analyticsData?.weeklyData}>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                  <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(value) => `${Math.round((value as number) / 60)}h`} />
                  <Tooltip
                    formatter={(value) => [formatHours(toNumber(value)), 'Study time']}
                    contentStyle={{
                      backgroundColor: 'rgba(2, 6, 23, 0.95)',
                      border: '1px solid rgba(148, 163, 184, 0.16)',
                      borderRadius: '16px',
                      color: '#f8fafc',
                    }}
                  />
                  <Bar dataKey="studyTime" fill="#38bdf8" radius={[12, 12, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartSection>

          <ChartSection title="Productivity Trend" description="How your daily focus score is shifting through the week.">
            <div className="h-72 rounded-3xl border border-white/10 bg-white/5 p-3 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analyticsData?.productivityTrend}>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 12 }} tickFormatter={formatTrendLabel} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" domain={[0, 100]} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(value) => [formatPercent(toNumber(value)), 'Productivity']}
                    contentStyle={{
                      backgroundColor: 'rgba(2, 6, 23, 0.95)',
                      border: '1px solid rgba(148, 163, 184, 0.16)',
                      borderRadius: '16px',
                      color: '#f8fafc',
                    }}
                  />
                  <Line type="monotone" dataKey="score" stroke="#34d399" strokeWidth={3} dot={{ fill: '#34d399' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartSection>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <ChartSection title="Time by Subject" description="A clean distribution view of where completed study sessions have been spent.">
            <div className="h-72 rounded-3xl border border-white/10 bg-white/5 p-3 sm:h-80">
              {analyticsData?.subjectData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analyticsData.subjectData}
                      cx="50%"
                      cy="50%"
                      innerRadius={56}
                      outerRadius={96}
                      paddingAngle={4}
                      dataKey="timeMinutes"
                    >
                      {analyticsData.subjectData.map((entry, index) => (
                        <Cell key={`${entry.subject}-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [formatMinutes(toNumber(value)), 'Study allocation']}
                      contentStyle={{
                        backgroundColor: 'rgba(2, 6, 23, 0.95)',
                        border: '1px solid rgba(148, 163, 184, 0.16)',
                        borderRadius: '16px',
                        color: '#f8fafc',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-white/12 bg-white/4 px-6 text-center text-slate-400">
                  Subject distribution appears after completed study sessions are recorded.
                </div>
              )}
            </div>
          </ChartSection>

          <ChartSection
            title="Subject Performance"
            description="Subject workload and output summarized in a simple, scannable panel."
            action={<BrainCircuit className="h-5 w-5 text-sky-200" />}
          >
            <div className="space-y-3">
              {analyticsData?.subjectData.length ? (
                analyticsData.subjectData.map((subject, index) => (
                  <div key={subject.subject} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-4 w-4 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <div>
                          <p className="font-medium text-white">{subject.subject}</p>
                          <p className="text-sm text-slate-400">{subject.tasks} tasks tracked</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-white">{formatMinutes(subject.timeMinutes)}</p>
                        <p className="text-sm text-slate-400">Study allocation</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-white/12 bg-white/4 px-6 py-12 text-center text-slate-400">
                  Analytics will populate here after subject activity is recorded.
                </div>
              )}
            </div>
          </ChartSection>
        </div>

        <ChartSection title="Study Insights" description="Data-backed patterns pulled from your tracked sessions this week.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-3xl border border-emerald-400/15 bg-emerald-500/10 p-5">
              <h3 className="font-medium text-emerald-200">Top Study Day</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {bestStudyDay && bestStudyDay.studyTime > 0
                  ? `${bestStudyDay.day} led the week with ${formatMinutes(bestStudyDay.studyTime)} tracked.`
                  : 'No completed sessions were recorded in the last seven days.'}
              </p>
            </div>
            <div className="rounded-3xl border border-sky-400/15 bg-sky-500/10 p-5">
              <h3 className="font-medium text-sky-200">Weekly Improvement</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {weeklyInsights[0]
                  ? weeklyInsights[0]
                  : todayStudyMinutes === 0 && yesterdayStudyMinutes === 0
                    ? 'No completed sessions were recorded today or yesterday.'
                    : `${formatMinutes(todayStudyMinutes)} tracked today, ${todayDeltaLabel}.`}
              </p>
            </div>
            <div className="rounded-3xl border border-violet-400/15 bg-violet-500/10 p-5">
              <h3 className="font-medium text-violet-200">Peak Distraction Window</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {peakWindow
                  ? `${peakWindow.label} shows the highest distraction load with ${formatMinutes(peakWindow.distractionMinutes)} across ${peakWindow.sessionCount} session${peakWindow.sessionCount === 1 ? '' : 's'}.`
                  : topSubject && topSubject.timeMinutes > 0
                    ? `${topSubject.subject} accounts for ${formatMinutes(topSubject.timeMinutes)} across ${topSubject.tasks} tracked task${topSubject.tasks === 1 ? '' : 's'}.`
                    : 'Session-level behavior insights will appear after more tracked focus blocks.'}
              </p>
            </div>
          </div>
        </ChartSection>
          </>
        )}
      </div>
    </AppShell>
  );
}
