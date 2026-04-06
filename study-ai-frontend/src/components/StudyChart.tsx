'use client';

import ChartSection from '@/components/ChartSection';
import { formatHours, formatMinutes } from '@/lib/format';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const toNumber = (value: unknown) => (typeof value === 'number' ? value : Number(value ?? 0));

interface StudyChartProps {
  data: {
    productiveTime: number;
    unproductiveTime: number;
    neutralTime?: number;
  } | null;
}

export default function StudyChart({ data }: StudyChartProps) {
  if (!data) return null;

  const distributionData = [
    { name: 'Study', value: data.productiveTime, color: '#10b981' },
    { name: 'Distraction', value: data.unproductiveTime, color: '#f97316' },
    { name: 'Neutral', value: Math.max(0, data.neutralTime ?? 0), color: '#64748b' },
  ];

  const trendData = distributionData.map((item) => ({
    label: item.name,
    minutes: item.value,
  }));

  return (
    <ChartSection
      title="Time Distribution"
      description="Study, distraction, and neutral activity are separated into a quick visual snapshot with labels and tooltips."
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="h-72 rounded-3xl border border-white/10 bg-white/5 p-3 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ left: 0, right: 12, top: 16, bottom: 0 }}>
              <defs>
                <linearGradient id="studyAreaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
              <XAxis dataKey="label" stroke="#64748b" tickLine={false} axisLine={false} />
              <YAxis
                stroke="#64748b"
                tickFormatter={(value) => `${Math.round((value as number) / 60)}h`}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(value) => [formatMinutes(toNumber(value)), 'Tracked time']}
                contentStyle={{
                  backgroundColor: 'rgba(2, 6, 23, 0.95)',
                  border: '1px solid rgba(148, 163, 184, 0.16)',
                  borderRadius: '16px',
                  color: '#f8fafc',
                }}
              />
              <Area
                type="monotone"
                dataKey="minutes"
                stroke="#38bdf8"
                strokeWidth={3}
                fill="url(#studyAreaFill)"
                activeDot={{ r: 6, fill: '#f8fafc', stroke: '#38bdf8' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:grid-cols-1">
          <div className="h-72 rounded-3xl border border-white/10 bg-white/5 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={94}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {distributionData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [formatMinutes(toNumber(value)), 'Tracked time']}
                  contentStyle={{
                    backgroundColor: 'rgba(2, 6, 23, 0.95)',
                    border: '1px solid rgba(148, 163, 184, 0.16)',
                    borderRadius: '16px',
                    color: '#f8fafc',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3">
            {distributionData.map((item) => (
              <div key={item.name} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm font-medium text-slate-200">{item.name}</span>
                  </div>
                  <span className="text-sm text-slate-400">{formatHours(item.value)}</span>
                </div>
                <p className="mt-2 text-sm text-slate-500">{formatMinutes(item.value)} recorded today</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ChartSection>
  );
}
