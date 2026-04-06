import { ReactNode } from 'react';

interface DashboardCardProps {
  title: string;
  value?: string;
  description?: string;
  eyebrow?: string;
  icon?: ReactNode;
  accent?: 'blue' | 'emerald' | 'violet' | 'amber' | 'rose';
  children?: ReactNode;
  className?: string;
}

const accentStyles = {
  blue: 'from-sky-400/20 via-sky-500/10 to-cyan-400/5 text-sky-200',
  emerald: 'from-emerald-400/20 via-emerald-500/10 to-teal-400/5 text-emerald-200',
  violet: 'from-violet-400/20 via-violet-500/10 to-fuchsia-400/5 text-violet-200',
  amber: 'from-amber-400/20 via-orange-500/10 to-yellow-400/5 text-amber-100',
  rose: 'from-rose-400/20 via-rose-500/10 to-pink-400/5 text-rose-100',
};

export default function DashboardCard({
  title,
  value,
  description,
  eyebrow,
  icon,
  accent = 'blue',
  children,
  className = '',
}: DashboardCardProps) {
  return (
    <section
      className={`surface-card-soft group relative min-w-0 overflow-hidden rounded-[28px] p-4 transition-transform duration-300 hover:-translate-y-1 sm:p-5 ${className}`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${accentStyles[accent]} opacity-80`} />
      <div className="surface-overlay absolute inset-px rounded-[27px]" style={{ border: '1px solid var(--border)' }} />
      <div className="relative">
        {(eyebrow || icon) && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            {eyebrow ? (
              <span className="badge-soft rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em]">
                {eyebrow}
              </span>
            ) : (
              <span />
            )}
            {icon ? (
              <div className="badge-soft rounded-2xl p-2">{icon}</div>
            ) : null}
          </div>
        )}
        <h3 className="text-secondary text-sm font-medium">{title}</h3>
        {value ? <p className="text-primary mt-3 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{value}</p> : null}
        {description ? <p className="text-tertiary mt-2 text-sm leading-6">{description}</p> : null}
        {children ? <div className="mt-5">{children}</div> : null}
      </div>
    </section>
  );
}
