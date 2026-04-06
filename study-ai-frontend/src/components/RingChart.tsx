'use client';

import { motion } from 'framer-motion';

interface RingChartProps {
  label: string;
  value: string;
  progress: number;
  caption: string;
  gradientId: string;
  colors: [string, string];
}

export default function RingChart({
  label,
  value,
  progress,
  caption,
  gradientId,
  colors,
}: RingChartProps) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.max(0, Math.min(progress, 100));
  const dashOffset = circumference - (clampedProgress / 100) * circumference;

  return (
    <div className="flex min-w-0 flex-col items-center rounded-[28px] border border-white/10 bg-white/6 p-4 text-center backdrop-blur-md sm:p-5">
      <div className="relative h-32 w-32 sm:h-36 sm:w-36">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 140 140" aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colors[0]} />
              <stop offset="100%" stopColor={colors[1]} />
            </linearGradient>
          </defs>
          <circle
            cx="70"
            cy="70"
            r={radius}
            stroke="rgba(148, 163, 184, 0.16)"
            strokeWidth="12"
            fill="transparent"
          />
          <motion.circle
            cx="70"
            cy="70"
            r={radius}
            stroke={`url(#${gradientId})`}
            strokeWidth="12"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={circumference}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1.4, ease: 'easeOut' }}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs uppercase tracking-[0.22em] text-slate-400">{label}</span>
          <span className="mt-1 break-words text-2xl font-semibold tracking-tight text-white sm:text-3xl">{value}</span>
        </div>
      </div>
      <p className="mt-4 max-w-xs text-sm text-slate-300">{caption}</p>
    </div>
  );
}
