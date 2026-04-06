'use client';

import ChartSection from '@/components/ChartSection';
import RingChart from '@/components/RingChart';
import { formatHours, formatPercent } from '@/lib/format';

interface ProductivityRingsProps {
  data: {
    totalStudyMinutes: number;
    consistencyPercentage: number;
    avgStudyTime: number;
    productivity?: {
      productivityScore: number;
    };
  } | null;
}

export default function ProductivityRings({ data }: ProductivityRingsProps) {
  if (!data) return null;

  const studyProgress = Math.min((data.totalStudyMinutes / 360) * 100, 100);
  const productivityScore = data.productivity?.productivityScore || 0;
  const consistencyScore = data.consistencyPercentage || 0;

  return (
    <ChartSection
      title="Momentum Rings"
      description="A quick Apple-style snapshot of your focus, output, and study consistency."
      action={
        <div className="inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-slate-300 sm:w-auto">
          Avg daily study {formatHours(data.avgStudyTime)}
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <RingChart
          label="Study"
          value={formatHours(data.totalStudyMinutes)}
          progress={studyProgress}
          caption="Targeting a strong weekly focus pace."
          gradientId="study-progress-gradient"
          colors={['#38bdf8', '#818cf8']}
        />
        <RingChart
          label="Productivity"
          value={formatPercent(productivityScore)}
          progress={productivityScore}
          caption="Measures productive time against all tracked activity."
          gradientId="productivity-progress-gradient"
          colors={['#34d399', '#22c55e']}
        />
        <RingChart
          label="Consistency"
          value={formatPercent(consistencyScore)}
          progress={consistencyScore}
          caption="Based on active study days across your routine."
          gradientId="consistency-progress-gradient"
          colors={['#f59e0b', '#fb7185']}
        />
      </div>
    </ChartSection>
  );
}
