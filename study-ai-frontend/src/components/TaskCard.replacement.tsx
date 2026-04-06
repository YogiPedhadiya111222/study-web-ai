'use client';

import { memo, useEffect, useState } from 'react';
import { Clock3, Eye, EyeOff, Flag, Loader2, Pause, Pencil, Play, Square, Sparkles, Trash2 } from 'lucide-react';
import { formatMinutes } from '@/lib/format';
import {
  getStudySessionDurationMinutes,
  getStudySessionStatus,
  sumCompletedStudySessionMinutes,
  type StudySession,
} from '@/lib/sessionApi';
import { formatStudySessionClock, getStudySessionElapsedSeconds } from '@/lib/sessionTimer';

interface Task {
  _id: string;
  title: string;
  subject: string;
  progress: number;
  priority: number;
  status: string;
  isHidden?: boolean;
  expectedStudyMinutes?: number;
  totalStudyTime?: number;
  realStudyMinutes?: number;
  sessionHistory?: StudySession[];
}

interface TaskCardProps {
  task: Task;
  session: StudySession | null;
  hasOtherOpenSession: boolean;
  isSessionMutating: boolean;
  onStart: (taskId: string) => void;
  onPause: (taskId: string) => void;
  onResume: (taskId: string) => void;
  onStop: (taskId: string) => void;
  onEndTask: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onEdit: (taskId: string) => void;
  onToggleVisibility: (taskId: string, isHidden: boolean) => void;
  actionState?: 'start' | 'pause' | 'resume' | 'stop' | 'end' | 'delete' | 'update' | 'hide' | null;
}

const statusStyles: Record<string, string> = {
  completed: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/25',
  'in-progress': 'bg-sky-500/15 text-sky-200 border-sky-400/25',
  pending: 'badge-soft',
};

const actionButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60';
const iconButtonClass =
  'surface-card-strong text-tertiary inline-flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-300/35 hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40 disabled:cursor-not-allowed disabled:opacity-50';

function areSessionsEqual(previousSession: StudySession | null, nextSession: StudySession | null) {
  if (previousSession === nextSession) {
    return true;
  }

  if (!previousSession || !nextSession) {
    return previousSession === nextSession;
  }

  return (
    previousSession._id === nextSession._id &&
    previousSession.status === nextSession.status &&
    previousSession.endTime === nextSession.endTime &&
    previousSession.isPaused === nextSession.isPaused &&
    previousSession.duration === nextSession.duration &&
    previousSession.durationMinutes === nextSession.durationMinutes &&
    previousSession.trackedMinutes === nextSession.trackedMinutes &&
    previousSession.totalPausedMs === nextSession.totalPausedMs &&
    previousSession.totalPausedTime === nextSession.totalPausedTime &&
    previousSession.updatedAt === nextSession.updatedAt
  );
}

function areSessionHistoriesEqual(previousSessions: StudySession[] = [], nextSessions: StudySession[] = []) {
  if (previousSessions === nextSessions) {
    return true;
  }

  if (previousSessions.length !== nextSessions.length) {
    return false;
  }

  return previousSessions.every((session, index) => areSessionsEqual(session, nextSessions[index] ?? null));
}

function TaskCard({
  task,
  session,
  hasOtherOpenSession,
  isSessionMutating,
  onStart,
  onPause,
  onResume,
  onStop,
  onEndTask,
  onDelete,
  onEdit,
  onToggleVisibility,
  actionState = null,
}: TaskCardProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(() => getStudySessionElapsedSeconds(session));
  const sessionStatus = session ? getStudySessionStatus(session) : null;
  const isRunning = sessionStatus === 'active';
  const isPaused = sessionStatus === 'paused';
  const isTaskSessionOpen = isRunning || isPaused;
  const isCompleted = task.status === 'completed';
  const completedHistoryMinutes = sumCompletedStudySessionMinutes(task.sessionHistory);
  const sessionSeconds = session ? elapsedSeconds : 0;
  const sessionAlreadyCountedInHistory = Boolean(
    session && (task.sessionHistory ?? []).some((historySession) => historySession._id === session._id),
  );
  const completedSessionSeconds =
    session && !isTaskSessionOpen && !sessionAlreadyCountedInHistory
      ? getStudySessionDurationMinutes(session) * 60
      : 0;
  const totalTrackedSeconds = completedHistoryMinutes * 60 + (isTaskSessionOpen ? sessionSeconds : completedSessionSeconds);
  const sharedActionLock = isSessionMutating && actionState === null;
  const shouldDisableStart = isCompleted || hasOtherOpenSession || isTaskSessionOpen || sharedActionLock || actionState === 'start';
  const shouldDisablePause = !isRunning || sharedActionLock || actionState !== null;
  const shouldDisableResume = !isPaused || sharedActionLock || actionState !== null;
  const shouldDisableStop = !isTaskSessionOpen || sharedActionLock || actionState !== null;
  const shouldDisableTaskActions = sharedActionLock || actionState !== null;
  const shouldDisableEdit = shouldDisableTaskActions;
  const shouldDisableVisibilityToggle = isTaskSessionOpen || shouldDisableTaskActions;
  const timerLabel = formatStudySessionClock(totalTrackedSeconds);
  const currentSessionLabel = formatStudySessionClock(
    isTaskSessionOpen ? sessionSeconds : (session ? getStudySessionDurationMinutes(session) * 60 : 0),
  );
  const timerStateLabel = isRunning
    ? 'Tracking live right now'
    : isPaused
      ? 'Paused and ready to resume'
      : totalTrackedSeconds > 0
        ? 'Recorded across finished sessions'
        : hasOtherOpenSession
          ? 'Another task is currently holding the live timer'
          : 'Ready for a fresh study session';

  useEffect(() => {
    if (!session) {
      return;
    }

    const syncElapsedTime = () => {
      setElapsedSeconds(getStudySessionElapsedSeconds(session));
    };

    syncElapsedTime();

    if (!isRunning) {
      return;
    }

    const interval = window.setInterval(syncElapsedTime, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [isRunning, session]);

  return (
    <article
      className={`group relative min-w-0 overflow-hidden rounded-[28px] border p-4 shadow-[0_24px_80px_rgba(2,6,23,0.32)] transition-all duration-300 sm:p-5 ${
        isRunning
          ? 'border-sky-400/40 bg-[linear-gradient(145deg,rgba(14,165,233,0.18),rgba(15,23,42,0.92))]'
          : isPaused
            ? 'border-amber-400/35 bg-[linear-gradient(145deg,rgba(245,158,11,0.14),rgba(15,23,42,0.92))]'
            : task.isHidden
              ? 'surface-card hover:border-[var(--border-strong)]'
              : 'surface-card hover:border-sky-400/25'
      }`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,rgba(255,255,255,0),rgba(125,211,252,0.9),rgba(255,255,255,0))] transition-opacity duration-300 ${
          isTaskSessionOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'
        }`}
      />
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2 opacity-100 transition-all duration-300 sm:translate-y-1 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:group-focus-within:translate-y-0 sm:group-focus-within:opacity-100">
        <button
          type="button"
          onClick={() => onEdit(task._id)}
          disabled={shouldDisableEdit}
          title="Edit task"
          aria-label={`Edit ${task.title}`}
          className={iconButtonClass}
        >
          {actionState === 'update' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => onToggleVisibility(task._id, Boolean(task.isHidden))}
          disabled={shouldDisableVisibilityToggle}
          title={task.isHidden ? 'Unhide task' : isTaskSessionOpen ? 'Stop or pause the live session before hiding' : 'Hide task'}
          aria-label={`${task.isHidden ? 'Unhide' : 'Hide'} ${task.title}`}
          className={iconButtonClass}
        >
          {actionState === 'hide' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : task.isHidden ? (
            <Eye className="h-4 w-4" />
          ) : (
            <EyeOff className="h-4 w-4" />
          )}
        </button>
      </div>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1 space-y-4 pr-20">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${statusStyles[task.status] ?? statusStyles.pending}`}>
              {task.status.replace('-', ' ')}
            </span>
            <span className="text-muted text-xs font-medium uppercase tracking-[0.22em]">{task.subject}</span>
            {task.isHidden ? (
              <span className="badge-soft rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.18em]">
                Hidden
              </span>
            ) : null}
            {isTaskSessionOpen ? (
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
                  isRunning
                    ? 'border-sky-300/30 bg-sky-400/15 text-sky-100'
                    : 'border-amber-300/30 bg-amber-400/15 text-amber-100'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${isRunning ? 'animate-pulse bg-sky-300' : 'bg-amber-300'}`} />
                {isRunning ? 'Active timer' : 'Timer paused'}
              </span>
            ) : null}
          </div>

          <div>
            <h3 className="text-primary break-words text-lg font-semibold">{task.title}</h3>
            <p className="text-tertiary mt-1 text-sm">
              Priority score {Math.round(task.priority)} with {task.progress}% completion.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
            <div
              className={`rounded-[24px] border p-4 ${
                isRunning
                  ? 'border-sky-300/20 bg-sky-400/10'
                  : isPaused
                    ? 'border-amber-300/20 bg-amber-400/10'
                    : 'border-white/10 bg-black/20'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-tertiary text-xs font-medium uppercase tracking-[0.22em]">Tracked time</span>
                <Clock3 className={`h-4 w-4 ${isRunning ? 'text-sky-200' : isPaused ? 'text-amber-200' : 'text-[var(--text-tertiary)]'}`} />
              </div>
              <p className="text-primary mt-3 font-mono text-3xl font-semibold tracking-tight sm:text-[2rem]">{timerLabel}</p>
              <p className="text-secondary mt-2 text-sm">{timerStateLabel}</p>
              {session ? (
                <p className="text-muted mt-2 text-xs uppercase tracking-[0.18em]">
                  Session {isTaskSessionOpen ? 'now' : 'last'}: {currentSessionLabel}
                </p>
              ) : null}
            </div>

            <div className="surface-card-soft rounded-[24px] p-4">
              <div className="text-secondary flex flex-wrap items-center gap-4 text-sm">
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  Priority {Math.round(task.priority)}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-sky-300" />
                  Target {(task.expectedStudyMinutes ?? 0) || 'Flexible'} min
                </span>
                <span className="inline-flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-emerald-300" />
                  Logged {formatMinutes(Math.floor(totalTrackedSeconds / 60))}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[220px] xl:grid-cols-1">
          {isTaskSessionOpen ? (
            <button
              type="button"
              onClick={() => (isPaused ? onResume(task._id) : onPause(task._id))}
              disabled={isPaused ? shouldDisableResume : shouldDisablePause}
              className={`${actionButtonClass} border border-amber-400/20 bg-amber-500/15 text-amber-100 hover:-translate-y-0.5 hover:border-amber-300/35 hover:bg-amber-500/25`}
            >
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {actionState === 'pause' ? 'Pausing...' : actionState === 'resume' ? 'Resuming...' : isPaused ? 'Resume' : 'Pause'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onStart(task._id)}
              disabled={shouldDisableStart}
              className={`${actionButtonClass} border border-emerald-400/20 bg-emerald-500/15 text-emerald-100 hover:-translate-y-0.5 hover:border-emerald-300/35 hover:bg-emerald-500/25`}
            >
              <Play className="h-4 w-4" />
              {actionState === 'start' ? 'Starting...' : 'Start'}
            </button>
          )}

          {isTaskSessionOpen ? (
            <button
              type="button"
              onClick={() => onStop(task._id)}
              disabled={shouldDisableStop}
              className={`${actionButtonClass} border border-rose-400/20 bg-rose-500/15 text-rose-100 hover:-translate-y-0.5 hover:border-rose-300/35 hover:bg-rose-500/25`}
            >
              <Square className="h-4 w-4" />
              {actionState === 'stop' ? 'Stopping...' : 'Stop'}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => onEndTask(task._id)}
            disabled={isCompleted || shouldDisableTaskActions}
            className={`${actionButtonClass} border border-slate-400/20 bg-white/5 text-slate-200 hover:-translate-y-0.5 hover:border-slate-200/35 hover:bg-white/10`}
          >
            <Flag className="h-4 w-4" />
            {actionState === 'end' ? 'Ending...' : 'End Task'}
          </button>

          <button
            type="button"
            onClick={() => onDelete(task._id)}
            disabled={shouldDisableTaskActions}
            className={`${actionButtonClass} border border-red-400/20 bg-red-500/15 text-red-100 hover:-translate-y-0.5 hover:border-red-300/35 hover:bg-red-500/25`}
          >
            <Trash2 className="h-4 w-4" />
            {actionState === 'delete' ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <div className="h-2 rounded-full bg-[var(--surface-soft)]">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#38bdf8_0%,#818cf8_50%,#34d399_100%)] transition-all duration-500"
            style={{ width: `${Math.max(0, Math.min(task.progress, 100))}%` }}
          />
        </div>
      </div>
    </article>
  );
}

function areTaskCardPropsEqual(previousProps: TaskCardProps, nextProps: TaskCardProps) {
  return (
    previousProps.task._id === nextProps.task._id &&
    previousProps.task.title === nextProps.task.title &&
    previousProps.task.subject === nextProps.task.subject &&
    previousProps.task.progress === nextProps.task.progress &&
    previousProps.task.priority === nextProps.task.priority &&
    previousProps.task.status === nextProps.task.status &&
    previousProps.task.isHidden === nextProps.task.isHidden &&
    previousProps.task.expectedStudyMinutes === nextProps.task.expectedStudyMinutes &&
    previousProps.task.totalStudyTime === nextProps.task.totalStudyTime &&
    previousProps.task.realStudyMinutes === nextProps.task.realStudyMinutes &&
    areSessionHistoriesEqual(previousProps.task.sessionHistory, nextProps.task.sessionHistory) &&
    previousProps.hasOtherOpenSession === nextProps.hasOtherOpenSession &&
    previousProps.isSessionMutating === nextProps.isSessionMutating &&
    previousProps.actionState === nextProps.actionState &&
    areSessionsEqual(previousProps.session, nextProps.session)
  );
}

const MemoizedTaskCard = memo(TaskCard, areTaskCardPropsEqual);

MemoizedTaskCard.displayName = 'TaskCard';

export default MemoizedTaskCard;
