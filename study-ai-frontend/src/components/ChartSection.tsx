import { ReactNode } from 'react';

interface ChartSectionProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}

export default function ChartSection({ title, description, action, children }: ChartSectionProps) {
  return (
    <section className="surface-card relative min-w-0 overflow-hidden rounded-[30px] p-4 sm:p-6">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h2 className="text-primary text-lg font-semibold tracking-tight sm:text-xl">{title}</h2>
          {description ? <p className="text-tertiary max-w-2xl text-sm leading-6">{description}</p> : null}
        </div>
        {action ? <div className="flex w-full shrink-0 sm:w-auto sm:justify-end">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
