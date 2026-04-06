'use client';

import { useEffect, useState } from 'react';
import { Clock3, MapPin } from 'lucide-react';

const INDIA_TIMEZONE = 'Asia/Kolkata';

const timeFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: INDIA_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
});

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: INDIA_TIMEZONE,
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

export default function LiveClock() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const currentDate = new Date(now);

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-amber-400/20 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.22),rgba(124,45,18,0.12)_35%,rgba(15,23,42,0.92)_80%)] p-5 shadow-[0_28px_100px_rgba(15,23,42,0.42)] backdrop-blur-2xl sm:p-6">
      <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-amber-300/15 blur-3xl" />
      <div className="relative">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-amber-100">
          <Clock3 className="h-4 w-4" />
          Live clock
        </div>

        <p className="mt-5 text-xs uppercase tracking-[0.22em] text-amber-100/70">Current time</p>
        <p className="mt-3 font-mono text-4xl font-semibold tracking-tight text-[var(--foreground)] sm:text-5xl">
          {timeFormatter.format(currentDate)}
        </p>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">{dateFormatter.format(currentDate)}</p>

        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-black/20 px-3 py-2 text-sm text-amber-100">
          <MapPin className="h-4 w-4" />
          Asia/Kolkata
        </div>
      </div>
    </section>
  );
}
