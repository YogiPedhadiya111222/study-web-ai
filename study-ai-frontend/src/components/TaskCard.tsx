'use client';

export { default } from '@/components/TaskCardRealtime';

/*
'use client';

import { useEffect, useState } from 'react';
import { Clock3, Flag, Pause, Play, Square, Sparkles, Trash2 } from 'lucide-react';
import { getStudySessionStatus, type StudySession } from '@/lib/sessionApi';
import { formatStudySessionClock, getStudySessionElapsedSeconds } from '@/lib/sessionTimer';

interface Task {
  _id: string;
  title: string;
  subject: string;
  progress: number;
  priority: number;
  status: string;
  expectedStudyMinutes?: number;
}
*/

/*

interface TaskCardProps {
  task: Task;
  session: StudySession | null;
  hasOtherOpenSession: boolean;
  onStart: (taskId: string) => void;
  onPause: (taskId: string) => void;
  onResume: (taskId: string) => void;
  onStop: (taskId: string) => void;
  onEndTask: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  actionState?: 'start' | 'pause' | 'resume' | 'stop' | 'end' | 'delete' | null;
}
*/

/*
const statusStyles: Record<string, string> = {
  completed: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/25',
  'in-progress': 'bg-sky-500/15 text-sky-200 border-sky-400/25',
  pending: 'bg-white/8 text-slate-200 border-white/10',
};

export default function TaskCard({
  task,
  session,
  hasOtherOpenSession,
  onStart,
  onPause,
  onResume,
  onStop,
  onEndTask,
  onDelete,
  actionState = null,
}: TaskCardProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const sessionStatus = session ? getStudySessionStatus(session) : null;
  const isTaskSessionOpen = sessionStatus === 'active' || sessionStatus === 'paused';
  const isCompleted = task.status === 'completed';
  const shouldShowTimer = Boolean(session) && (isTaskSessionOpen || elapsedTime > 0);
  const shouldDisableStart = isCompleted || hasOtherOpenSession || isTaskSessionOpen || actionState !== null;
  const isCurrentTask = shouldShowTimer;
  const isStarting = actionState === 'start';
  const formatTime = formatStudySessionClock;

  useEffect(() => {
    if (!session) {
      setElapsedTime(0);
      return;
    }

    const updateTime = () => {
      setElapsedTime(getStudySessionElapsedSeconds(session));
    };

    updateTime();

    if (sessionStatus !== 'active') {
      return;
    }

    const interval = window.setInterval(updateTime, 1000);
    return () => {
      window.clearInterval(interval);
    };
  }, [session, sessionStatus]);

  return (
    <article className="min-w-0 rounded-[26px] border border-white/10 bg-slate-950/70 p-4 shadow-[0_20px_60px_rgba(2,6,23,0.28)] transition-all duration-300 hover:border-sky-400/30 hover:bg-slate-900/80 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${statusStyles[task.status] ?? statusStyles.pending}`}>
              {task.status.replace('-', ' ')}
            </span>
            <span className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">{task.subject}</span>
          </div>
          <div>
            <h3 className="break-words text-lg font-semibold text-white">{task.title}</h3>
            {isCurrentTask ? (
              <p className="mt-1 text-sm text-slate-400">
                {sessionStatus === 'paused' ? 'On break' : 'In session'} · {formatTime(elapsedTime)}
              </p>
            ) : null}
            <p className="mt-1 text-sm text-slate-400">
              Priority score {Math.round(task.priority)} with {task.progress}% completion.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <button
            type="button"
            onClick={() => onStart(task._id)}
            disabled={shouldDisableStart || actionState !== null || isStarting}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/15 px-4 py-3 text-sm font-medium text-emerald-100 transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-300/35 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Play className="h-4 w-4" />
            {isStarting || actionState === 'start' ? 'Starting...' : 'Start'}
          </button>
          <button
            type="button"
            onClick={() => (sessionStatus === 'paused' ? onResume(task._id) : onPause(task._id))}
            disabled={!isCurrentTask || actionState !== null || sessionStatus === 'completed'}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-500/15 px-4 py-3 text-sm font-medium text-amber-100 transition-all duration-300 hover:-translate-y-0.5 hover:border-amber-300/35 hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Pause className="h-4 w-4" />
            {actionState === 'pause' ? 'Pausing...' : sessionStatus === 'paused' ? 'Resume' : 'Pause'}
          </button>
          <button
            type="button"
            onClick={() => onStop(task._id)}
            disabled={!isCurrentTask || actionState !== null}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-100 transition-all duration-300 hover:-translate-y-0.5 hover:border-rose-300/35 hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Square className="h-4 w-4" />
            {actionState === 'stop' ? 'Stopping...' : 'Stop'}
          </button>
          <button
            type="button"
            onClick={() => onEndTask(task._id)}
            disabled={isCompleted || actionState !== null}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-400/20 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-200/35 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Flag className="h-4 w-4" />
            {actionState === 'end' ? 'Ending...' : 'End Task'}
          </button>
          <button
            type="button"
            onClick={() => onDelete(task._id)}
            disabled={actionState !== null}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/15 px-4 py-3 text-sm font-medium text-red-100 transition-all duration-300 hover:-translate-y-0.5 hover:border-red-300/35 hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            {actionState === 'delete' ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <div className="h-2 rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#38bdf8_0%,#818cf8_50%,#34d399_100%)] transition-all duration-500"
            style={{ width: `${Math.max(0, Math.min(task.progress, 100))}%` }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
          <span className="inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-300" />
            Priority {Math.round(task.priority)}
          </span>
          <span className="inline-flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-sky-300" />
            {(task.expectedStudyMinutes ?? 0) || 'Flexible'} min target
          </span>
        </div>
      </div>
    </article>
  );
}
*/
