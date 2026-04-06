'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarRange,
  Clock3,
  Flame,
  Minus,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartSection from '@/components/ChartSection';
import { formatHours, formatMinutes } from '@/lib/format';

type TrendDirection = 'up' | 'down' | 'flat';

export interface MonthlyStudyData {
  totalMinutes: number;
  averageDailyMinutes: number;
  activeDays: number;
  bestDay: {
    day: string;
    date: string;
    studyTime: number;
  } | null;
  dailyBreakdown: Array<{
    day: string;
    date: string;
    studyTime: number;
  }>;
  trend: {
    direction: TrendDirection;
    deltaMinutes: number;
    percentChange: number;
    previousTotalMinutes: number;
  };
  streak: {
    currentDays: number;
    longestDays: number;
  };
}

interface MonthlyStudySectionProps {
  data: MonthlyStudyData;
}

const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

const fullDateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

const parseDayKey = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) {
    return null;
  }

  const parsedDate = new Date(year, month - 1, day);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const formatDateKey = (value: string, formatter: Intl.DateTimeFormat) => {
  const parsedDate = parseDayKey(value);
  return parsedDate ? formatter.format(parsedDate) : value;
};

const formatSignedMinutes = (value: number) => {
  if (value === 0) {
    return '0m';
  }

  return `${value > 0 ? '+' : '-'}${formatHours(Math.abs(value))}`;
};

const formatSignedPercent = (value: number) => {
  if (value === 0) {
    return '0%';
  }

  return `${value > 0 ? '+' : ''}${value}%`;
};

const formatDayCount = (value: number) => `${value} day${value === 1 ? '' : 's'}`;

const formatYAxisTick = (value: number) => {
  if (value <= 0) {
    return '0m';
  }

  if (value < 60) {
    return `${value}m`;
  }

  const hours = value / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
};

const toNumber = (value: unknown) => (typeof value === 'number' ? value : Number(value ?? 0));

const getTrendTone = (direction: TrendDirection) => {
  if (direction === 'up') {
    return {
      Icon: TrendingUp,
      className: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-50',
      iconClassName: 'text-emerald-200',
      eyebrow: 'Upward trend',
    };
  }

  if (direction === 'down') {
    return {
      Icon: TrendingDown,
      className: 'border-rose-400/20 bg-rose-500/10 text-rose-50',
      iconClassName: 'text-rose-200',
      eyebrow: 'Downward trend',
    };
  }

  return {
    Icon: Minus,
    className: 'border-slate-300/15 bg-white/5 text-slate-50',
    iconClassName: 'text-slate-200',
    eyebrow: 'Steady trend',
  };
};

const getTrendDescription = (data: MonthlyStudyData) => {
  if (data.totalMinutes === 0 && data.trend.previousTotalMinutes === 0) {
    return 'No completed sessions were recorded in this or the previous 30-day window.';
  }

  if (data.trend.previousTotalMinutes === 0 && data.totalMinutes > 0) {
    return 'You started building study history in this 30-day window.';
  }

  if (data.trend.direction === 'flat') {
    return 'Your total matched the previous 30-day study window.';
  }

  return `${formatSignedMinutes(data.trend.deltaMinutes)} (${formatSignedPercent(data.trend.percentChange)}) versus the previous 30 days.`;
};

const getStreakDescription = (streak: MonthlyStudyData['streak']) => {
  if (streak.longestDays === 0) {
    return 'Complete a study session to start building a streak.';
  }

  if (streak.currentDays > 0) {
    return `Current streak is ${formatDayCount(streak.currentDays)}, with a longest run of ${formatDayCount(streak.longestDays)} in this window.`;
  }

  return `No active streak today. Your longest run in this window was ${formatDayCount(streak.longestDays)}.`;
};

const getWindowLabel = (dailyBreakdown: MonthlyStudyData['dailyBreakdown']) => {
  if (!dailyBreakdown.length) {
    return 'Last 30 days';
  }

  const firstDate = dailyBreakdown[0]?.date;
  const lastDate = dailyBreakdown[dailyBreakdown.length - 1]?.date;

  return `${formatDateKey(firstDate, shortDateFormatter)} - ${formatDateKey(lastDate, shortDateFormatter)}`;
};

function SummaryCard({
  title,
  value,
  description,
  eyebrow,
  icon,
  toneClassName,
}: {
  title: string;
  value: string;
  description: string;
  eyebrow: string;
  icon: ReactNode;
  toneClassName: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.35 }}
      className={`rounded-[26px] border p-5 backdrop-blur-xl ${toneClassName}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-300">{eyebrow}</p>
          <h3 className="mt-3 text-sm font-medium text-slate-200">{title}</h3>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/10 p-2 text-slate-100">{icon}</div>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
    </motion.div>
  );
}

export default function MonthlyStudySection({ data }: MonthlyStudySectionProps) {
  const trendTone = getTrendTone(data.trend.direction);
  const bestDayLabel = data.bestDay ? formatDateKey(data.bestDay.date, fullDateFormatter) : 'No completed sessions yet';
  const bestDayValue = data.bestDay ? formatHours(data.bestDay.studyTime) : '0m';
  const streakValue =
    data.streak.currentDays > 0 ? formatDayCount(data.streak.currentDays) : formatDayCount(data.streak.longestDays);

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <ChartSection
        title="Monthly Study Time"
        description="A complete 30-day view of completed study sessions, with empty days kept visible so the pattern stays honest."
        action={
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-300">
            <CalendarRange className="h-4 w-4 text-sky-200" />
            Last 30 days
          </div>
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <SummaryCard
              title="Total study time"
              value={formatHours(data.totalMinutes)}
              description={`${data.activeDays} of 30 days had completed study sessions.`}
              eyebrow="Total"
              icon={<Clock3 className="h-5 w-5" />}
              toneClassName="border-sky-400/15 bg-sky-500/10"
            />
            <SummaryCard
              title="Average per day"
              value={formatMinutes(data.averageDailyMinutes)}
              description="This average includes zero-study days for a realistic monthly pace."
              eyebrow="Average"
              icon={<Flame className="h-5 w-5" />}
              toneClassName="border-emerald-400/15 bg-emerald-500/10"
            />
            <SummaryCard
              title="Most productive day"
              value={bestDayValue}
              description={
                data.bestDay
                  ? `${bestDayLabel} delivered your strongest completed-session total.`
                  : 'Complete a study session to surface your strongest day.'
              }
              eyebrow="Best day"
              icon={<Sparkles className="h-5 w-5" />}
              toneClassName="border-violet-400/15 bg-violet-500/10"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-white">Daily breakdown</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Study time from completed sessions for each day across the current 30-day window.
                  </p>
                </div>
                <div className="inline-flex items-center rounded-full border border-white/10 bg-slate-900/80 px-3 py-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-300">
                  {getWindowLabel(data.dailyBreakdown)}
                </div>
              </div>

              <div className="h-72 sm:h-80 lg:h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.dailyBreakdown} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="monthlyStudyFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.38} />
                        <stop offset="55%" stopColor="#38bdf8" stopOpacity={0.14} />
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#64748b"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => formatDateKey(String(value), shortDateFormatter)}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      minTickGap={24}
                      tickMargin={10}
                    />
                    <YAxis
                      stroke="#64748b"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => formatYAxisTick(toNumber(value))}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                    />
                    <Tooltip
                      labelFormatter={(value) => formatDateKey(String(value), fullDateFormatter)}
                      formatter={(value) => [formatHours(toNumber(value)), 'Study time']}
                      contentStyle={{
                        backgroundColor: 'rgba(2, 6, 23, 0.96)',
                        border: '1px solid rgba(148, 163, 184, 0.16)',
                        borderRadius: '16px',
                        color: '#f8fafc',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="studyTime"
                      stroke="#38bdf8"
                      strokeWidth={3}
                      fill="url(#monthlyStudyFill)"
                      dot={false}
                      activeDot={{ r: 5, fill: '#e0f2fe', stroke: '#38bdf8', strokeWidth: 2 }}
                    />
                    {data.bestDay ? (
                      <ReferenceDot
                        x={data.bestDay.date}
                        y={data.bestDay.studyTime}
                        r={6}
                        fill="#f59e0b"
                        stroke="#fef3c7"
                        strokeWidth={2}
                        ifOverflow="extendDomain"
                      />
                    ) : null}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.35, delay: 0.05 }}
                className={`rounded-[28px] border p-5 ${trendTone.className}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-300">{trendTone.eyebrow}</p>
                    <h3 className="mt-3 text-base font-semibold text-white">Month-over-month view</h3>
                  </div>
                  <div className={`rounded-2xl border border-white/10 bg-white/10 p-2 ${trendTone.iconClassName}`}>
                    <trendTone.Icon className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-5 text-3xl font-semibold tracking-tight text-white">{formatSignedMinutes(data.trend.deltaMinutes)}</p>
                <p className="mt-2 text-sm leading-6 text-slate-200/90">{getTrendDescription(data)}</p>
                <p className="mt-4 text-xs uppercase tracking-[0.18em] text-slate-300">
                  Previous 30 days: {formatHours(data.trend.previousTotalMinutes)}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.35, delay: 0.1 }}
                className="rounded-[28px] border border-white/10 bg-white/5 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-300">Streak insight</p>
                    <h3 className="mt-3 text-base font-semibold text-white">Consistency signal</h3>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/10 p-2 text-amber-100">
                    <Flame className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-5 text-3xl font-semibold tracking-tight text-white">{streakValue}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{getStreakDescription(data.streak)}</p>
                <p className="mt-4 text-xs uppercase tracking-[0.18em] text-slate-400">
                  Longest stretch: {formatDayCount(data.streak.longestDays)}
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </ChartSection>
    </motion.div>
  );
}
