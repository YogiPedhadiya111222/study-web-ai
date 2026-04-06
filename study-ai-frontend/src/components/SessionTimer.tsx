'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Pause, Play, Square } from 'lucide-react';
import { formatMinutes } from '@/lib/format';
import { getStudySessionStatus, type StudySession } from '@/lib/sessionApi';
import { formatStudySessionClock, getStudySessionElapsedSeconds } from '@/lib/sessionTimer';

interface SessionTimerProps {
  session: StudySession;
  taskTitle?: string;
  taskSubject?: string;
  recommendedBreakMinutes?: number;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onEndTask?: () => void;
  actionState?: 'pause' | 'resume' | 'stop' | 'complete' | null;
  focusModeEnabled?: boolean;
}

export default function SessionTimer({
  session,
  taskTitle,
  taskSubject,
  recommendedBreakMinutes = 10,
  onStop,
  onPause,
  onResume,
  onEndTask,
  actionState = null,
  focusModeEnabled = false,
}: SessionTimerProps) {
  const sessionStatus = getStudySessionStatus(session);
  const [elapsedSeconds, setElapsedSeconds] = useState(() => getStudySessionElapsedSeconds(session));
  const totalPausedMinutes = Math.max(0, session.totalPausedTime ?? 0);
  const trackedMinutes = Math.floor(elapsedSeconds / 60);
  const plannedMinutes = Math.max(0, session.plannedDurationMinutes ?? 0);
  const pauseCount = Math.max(0, session.pauseCount ?? 0);
  const appSwitchCount = Math.max(0, session.appSwitchCount ?? 0);
  const liveScore = plannedMinutes > 0 ? Math.min(100, Math.round((trackedMinutes / plannedMinutes) * 100)) : 0;

  useEffect(() => {
    const syncElapsedSeconds = () => {
      setElapsedSeconds(getStudySessionElapsedSeconds(session));
    };

    syncElapsedSeconds();

    if (sessionStatus !== 'active') {
      return;
    }

    const interval = window.setInterval(syncElapsedSeconds, 1000);
    return () => {
      window.clearInterval(interval);
    };
  }, [session, sessionStatus]);

  return (
    <div className="text-center">
      <div className="mx-auto mb-5 flex h-32 w-32 items-center justify-center rounded-full border border-sky-400/20 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.22),rgba(15,23,42,0.15)_55%,rgba(2,6,23,0.8)_100%)] shadow-[0_24px_80px_rgba(14,165,233,0.18)] sm:h-40 sm:w-40">
        <div className="text-2xl font-semibold tracking-tight text-sky-200 sm:text-3xl">{formatStudySessionClock(elapsedSeconds)}</div>
      </div>
      <p className="text-muted text-xs uppercase tracking-[0.22em]">{sessionStatus === 'paused' ? 'On break' : 'Active focus'}</p>
      {taskTitle ? <p className="text-primary mt-2 text-lg font-medium">{taskTitle}</p> : null}
      {taskSubject ? <p className="text-tertiary mt-1 text-sm">{taskSubject}</p> : null}
      <p className="text-tertiary mt-2 text-sm">Started at {new Date(session.startTime).toLocaleTimeString()}</p>
      <p className="text-muted mb-6 mt-1 text-sm">
        {sessionStatus === 'completed' ? 'Recorded duration' : 'Tracked so far'}: {formatMinutes(trackedMinutes)}.
        {' '}Paused for {totalPausedMinutes} minute{totalPausedMinutes === 1 ? '' : 's'} total.
      </p>
      {sessionStatus === 'paused' ? (
        <p className="text-secondary mb-6 text-sm">
          Recommended break length: {recommendedBreakMinutes} minute{recommendedBreakMinutes === 1 ? '' : 's'}.
        </p>
      ) : null}
      <div className="mb-6 grid grid-cols-2 gap-3 text-left sm:grid-cols-4">
        <div className="surface-card-soft rounded-2xl px-4 py-3">
          <p className="text-muted text-[11px] uppercase tracking-[0.2em]">Planned</p>
          <p className="text-primary mt-2 text-sm font-medium">{formatMinutes(plannedMinutes)}</p>
        </div>
        <div className="surface-card-soft rounded-2xl px-4 py-3">
          <p className="text-muted text-[11px] uppercase tracking-[0.2em]">Live Score</p>
          <p className="text-primary mt-2 text-sm font-medium">{liveScore}%</p>
        </div>
        <div className="surface-card-soft rounded-2xl px-4 py-3">
          <p className="text-muted text-[11px] uppercase tracking-[0.2em]">Pauses</p>
          <p className="text-primary mt-2 text-sm font-medium">{pauseCount}</p>
        </div>
        <div className="surface-card-soft rounded-2xl px-4 py-3">
          <p className="text-muted text-[11px] uppercase tracking-[0.2em]">App Switches</p>
          <p className="text-primary mt-2 text-sm font-medium">{appSwitchCount}</p>
        </div>
      </div>
      {focusModeEnabled ? (
        <div className="mb-6 rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          Focus Mode is on. Keep this screen front and center to reduce interruptions.
        </div>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        {sessionStatus === 'paused' ? (
          <button
            onClick={onResume}
            disabled={actionState !== null}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/15 px-6 py-3 font-medium text-emerald-100 transition-all duration-300 hover:-translate-y-0.5 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Play className="h-4 w-4" />
            {actionState === 'resume' ? 'Resuming...' : 'Resume Session'}
          </button>
        ) : (
          <button
            onClick={onPause}
            disabled={actionState !== null}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-500/15 px-6 py-3 font-medium text-amber-100 transition-all duration-300 hover:-translate-y-0.5 hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Pause className="h-4 w-4" />
            {actionState === 'pause' ? 'Pausing...' : 'Take Break'}
          </button>
        )}
        <button
          onClick={onStop}
          disabled={actionState !== null}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/15 px-6 py-3 font-medium text-rose-100 transition-all duration-300 hover:-translate-y-0.5 hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Square className="h-4 w-4" />
          {actionState === 'stop' ? 'Stopping...' : 'Stop Session'}
        </button>
        {onEndTask ? (
          <button
            onClick={onEndTask}
            disabled={actionState !== null}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-6 py-3 font-medium text-slate-100 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" />
            {actionState === 'complete' ? 'Ending task...' : 'End Task'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
