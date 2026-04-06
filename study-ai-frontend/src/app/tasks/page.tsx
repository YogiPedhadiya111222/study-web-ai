'use client';

import AppShell from '@/components/AppShell';
import ChartSection from '@/components/ChartSection';
import TaskList from '@/components/TaskListRealtime';

export default function TasksPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <ChartSection
          title="Task Planner"
          description="Create study tasks, track progress, and start a focused session directly from the task queue."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-slate-400">Organize</p>
              <p className="mt-2 text-lg font-semibold text-white">Capture every study goal in one place.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-slate-400">Prioritize</p>
              <p className="mt-2 text-lg font-semibold text-white">Focus the highest-value subject first.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-slate-400">Execute</p>
              <p className="mt-2 text-lg font-semibold text-white">Launch a session without leaving the list.</p>
            </div>
          </div>
        </ChartSection>

        <TaskList onTaskUpdate={() => {}} />
      </div>
    </AppShell>
  );
}
