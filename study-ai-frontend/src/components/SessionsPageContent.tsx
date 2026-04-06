'use client';

import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import ChartSection from '@/components/ChartSection';
import DashboardCard from '@/components/DashboardCard';
import { useSettings } from '@/components/SettingsProvider';
import SessionTimer from '@/components/SessionTimer';
import { DISTRACTION_OPTIONS, formatDistractionTag } from '@/lib/distraction';
import { formatMinutes, formatPercent } from '@/lib/format';
import { completeTask, getTasks, type TaskRecord } from '@/lib/taskApi';
import {
  getStudySessionStatus,
  getStudySessionTaskId,
  getActiveStudySession,
  sumCompletedStudySessionMinutes,
  getStudySessions,
  pauseStudySession,
  resumeStudySession,
  startStudySessionWithPlan,
  stopStudySession,
  updateStudySessionReflection,
  type DistractionTag,
  type StudySession,
} from '@/lib/sessionApi';
import {
  AlertTriangle,
  BellRing,
  Clock3,
  EyeOff,
  Flame,
  MonitorUp,
  PlayCircle,
  Shield,
  Timer,
} from 'lucide-react';

type SessionAction = 'pause' | 'resume' | 'stop' | 'complete' | null;
type SmartAlertTone = 'amber' | 'rose' | 'blue';

interface SmartAlertState {
  message: string;
  tone: SmartAlertTone;
}

const PLAN_PRESETS = [25, 45, 60, 90];

const getTaskMeta = (session: StudySession | null) => {
  if (!session?.taskId || typeof session.taskId === 'string') {
    return { title: 'Task session', subject: 'Focused work block' };
  }

  return {
    title: session.taskId.title ?? 'Task session',
    subject: session.taskId.subject ?? 'Focused work block',
  };
};

const getSessionStateLabel = (session: StudySession) => {
  const status = getStudySessionStatus(session);
  if (status === 'completed') return 'Completed';
  if (status === 'paused') return 'Paused';
  return 'Running';
};

const mergeSessionRecord = (sessions: StudySession[], nextSession: StudySession) => {
  const existingIndex = sessions.findIndex((session) => session._id === nextSession._id);

  if (existingIndex === -1) {
    return [nextSession, ...sessions];
  }

  return sessions.map((session) => (session._id === nextSession._id ? nextSession : session));
};

const getProductivityTone = (score = 0) => {
  if (score >= 90) {
    return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100';
  }

  if (score >= 70) {
    return 'border-sky-400/20 bg-sky-500/10 text-sky-100';
  }

  return 'border-amber-400/20 bg-amber-500/10 text-amber-100';
};

const getAlertToneClasses = (tone: SmartAlertTone) => {
  if (tone === 'rose') {
    return 'border-rose-400/20 bg-rose-500/10 text-rose-100';
  }

  if (tone === 'blue') {
    return 'border-sky-400/20 bg-sky-500/10 text-sky-100';
  }

  return 'border-amber-400/20 bg-amber-500/10 text-amber-100';
};

export default function SessionsPageContent() {
  const { settings, updateSettings } = useSettings();
  const [activeSession, setActiveSession] = useState<StudySession | null>(null);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [startingTaskId, setStartingTaskId] = useState<string | null>(null);
  const [actionState, setActionState] = useState<SessionAction>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [smartAlert, setSmartAlert] = useState<SmartAlertState | null>(null);
  const [appSwitchCount, setAppSwitchCount] = useState(0);
  const [trackedSessionId, setTrackedSessionId] = useState<string | null>(null);
  const [pendingReflectionSession, setPendingReflectionSession] = useState<StudySession | null>(null);
  const [reflectionSaving, setReflectionSaving] = useState(false);

  const selectedPlanMinutes = settings.studyPreferences.defaultSessionMinutes;
  const focusModeEnabled = settings.focusMode.enabled;

  const playFeedbackTone = useCallback((tone: SmartAlertTone) => {
    if (!settings.focusMode.sound || !settings.notifications.enabled || typeof window === 'undefined') {
      return;
    }

    try {
      const AudioContextClass = window.AudioContext;
      if (!AudioContextClass) {
        return;
      }

      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const now = audioContext.currentTime;

      oscillator.type = tone === 'rose' ? 'square' : 'sine';
      oscillator.frequency.value = tone === 'rose' ? 220 : tone === 'amber' ? 440 : 660;
      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.exponentialRampToValueAtTime(0.045, now + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.18);
      void audioContext.close().catch(() => {});
    } catch {
      // Browsers can block audio creation without a gesture; alerts still work visually.
    }
  }, [settings.focusMode.sound, settings.notifications.enabled]);

  const pushSmartAlert = useCallback(
    (
      message: string,
      tone: SmartAlertTone,
      options: { silent?: boolean; bypassNotifications?: boolean } = {},
    ) => {
      if (!options.bypassNotifications && !settings.notifications.enabled) {
        return;
      }

      setSmartAlert({ message, tone });
      if (!options.silent) {
        playFeedbackTone(tone);
      }
    },
    [playFeedbackTone, settings.notifications.enabled],
  );

  useEffect(() => {
    let cancelled = false;

    const loadInitialData = async () => {
      setLoading(true);

      try {
        const [taskData, sessionData, currentSession] = await Promise.all([
          getTasks(),
          getStudySessions(),
          getActiveStudySession(),
        ]);

        if (cancelled) {
          return;
        }

        startTransition(() => {
          setTasks(taskData);
          setSessions(sessionData);
          setActiveSession(currentSession);
        });
        setErrorMessage(null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error('Error loading sessions page:', error);
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load session data.');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const nextSessionId = activeSession?._id ?? null;

    if (nextSessionId === trackedSessionId) {
      return;
    }

    setTrackedSessionId(nextSessionId);
    setAppSwitchCount(activeSession?.appSwitchCount ?? 0);
  }, [activeSession?._id, activeSession?.appSwitchCount, trackedSessionId]);

  useEffect(() => {
    if (!smartAlert) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setSmartAlert(null);
    }, 5000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [smartAlert]);

  useEffect(() => {
    const listener = () => {
      if (!activeSession || getStudySessionStatus(activeSession) !== 'active') {
        return;
      }

      if (document.hidden) {
        setAppSwitchCount((currentCount) => currentCount + 1);
        return;
      }

      if (!settings.focusMode.strictMode) {
        return;
      }

      pushSmartAlert('You stepped away from this study block. Get back to focus.', appSwitchCount >= 2 ? 'rose' : 'amber');
    };

    document.addEventListener('visibilitychange', listener);

    return () => {
      document.removeEventListener('visibilitychange', listener);
    };
  }, [activeSession, appSwitchCount, pushSmartAlert, settings.focusMode.strictMode]);

  useEffect(() => {
    if (
      settings.focusMode.strictMode &&
      activeSession &&
      getStudySessionStatus(activeSession) === 'paused' &&
      (activeSession.pauseCount ?? 0) >= 3
    ) {
      pushSmartAlert('You are getting distracted. Get back to focus.', 'rose');
    }
  }, [activeSession, activeSession?.pauseCount, pushSmartAlert, settings.focusMode.strictMode]);

  useEffect(() => {
    if (settings.focusMode.strictMode && activeSession && appSwitchCount >= 3) {
      pushSmartAlert('Frequent tab switching detected. Try to stay with this focus block.', 'rose');
    }
  }, [activeSession, appSwitchCount, pushSmartAlert, settings.focusMode.strictMode]);

  const totalMinutes = useMemo(() => sumCompletedStudySessionMinutes(sessions), [sessions]);
  const quickStartTasks = useMemo(
    () => tasks.filter((task) => task.status !== 'completed').slice(0, 4),
    [tasks],
  );
  const averageProductivity = useMemo(() => {
    const completedSessions = sessions.filter((session) => getStudySessionStatus(session) === 'completed');
    if (!completedSessions.length) {
      return 0;
    }

    const totalScore = completedSessions.reduce((sum, session) => sum + (session.productivityScore ?? 0), 0);
    return Math.round(totalScore / completedSessions.length);
  }, [sessions]);
  const distractedSessions = useMemo(
    () => sessions.filter((session) => session.distractionDetected).length,
    [sessions],
  );
  const activeTask = getTaskMeta(activeSession);
  const activeTaskId = getStudySessionTaskId(activeSession);
  const activeSessionStatus = activeSession ? getStudySessionStatus(activeSession) : null;

  const toggleFocusMode = async () => {
    const nextFocusMode = !focusModeEnabled;
    updateSettings({ focusMode: { enabled: nextFocusMode } });

    try {
      if (nextFocusMode) {
        if (
          settings.focusMode.strictMode &&
          !document.fullscreenElement &&
          document.documentElement.requestFullscreen
        ) {
          await document.documentElement.requestFullscreen();
        }

        pushSmartAlert('Focus Mode enabled. Stay with this screen and keep interruptions low.', 'blue');
        return;
      }

      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Failed to toggle fullscreen for focus mode:', error);
      pushSmartAlert('Focus Mode changed, but fullscreen could not be updated in this browser.', 'amber', {
        silent: true,
      });
    }
  };

  const handleSessionStart = async (taskId: string) => {
    setStartingTaskId(taskId);
    setErrorMessage(null);
    setPendingReflectionSession(null);

    try {
      const session = await startStudySessionWithPlan(taskId, selectedPlanMinutes);

      if (
        focusModeEnabled &&
        settings.focusMode.autoStart &&
        settings.focusMode.strictMode &&
        !document.fullscreenElement &&
        document.documentElement.requestFullscreen
      ) {
        void document.documentElement.requestFullscreen().catch((error) => {
          console.error('Failed to enter fullscreen on session start:', error);
        });
      }

      startTransition(() => {
        setActiveSession(session);
        setSessions((currentSessions) => mergeSessionRecord(currentSessions, session));
        setTasks((currentTasks) =>
          currentTasks.map((task) =>
            task._id === taskId && task.status !== 'completed' ? { ...task, status: 'in-progress' } : task,
          ),
        );
      });

      if (focusModeEnabled) {
        pushSmartAlert(`Focus block started for ${selectedPlanMinutes} minutes.`, 'blue');
      }
    } catch (error) {
      console.error('Error starting session:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to start the study session.');
    } finally {
      setStartingTaskId(null);
    }
  };

  const handlePause = async () => {
    if (!activeSession) return;

    setActionState('pause');
    setErrorMessage(null);

    try {
      const session = await pauseStudySession(activeSession._id);

      startTransition(() => {
        setActiveSession(session);
        setSessions((currentSessions) => mergeSessionRecord(currentSessions, session));
      });
      pushSmartAlert(
        `Break started. Aim to resume in ${settings.studyPreferences.breakMinutes} minute${
          settings.studyPreferences.breakMinutes === 1 ? '' : 's'
        }.`,
        'amber',
        { silent: true },
      );
    } catch (error) {
      console.error('Error pausing session:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to pause the study session.');
    } finally {
      setActionState(null);
    }
  };

  const handleResume = async () => {
    if (!activeSession) return;

    setActionState('resume');
    setErrorMessage(null);

    try {
      const session = await resumeStudySession(activeSession._id);
      const resumedTaskId = getStudySessionTaskId(session);

      startTransition(() => {
        setActiveSession(session);
        setSessions((currentSessions) => mergeSessionRecord(currentSessions, session));
        if (resumedTaskId) {
          setTasks((currentTasks) =>
            currentTasks.map((task) =>
              task._id === resumedTaskId && task.status !== 'completed' ? { ...task, status: 'in-progress' } : task,
            ),
          );
        }
      });
      pushSmartAlert('Focus block resumed.', 'blue', { silent: true });
    } catch (error) {
      console.error('Error resuming session:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to resume the study session.');
    } finally {
      setActionState(null);
    }
  };

  const handleSessionStop = async () => {
    if (!activeSession) return;

    const stoppingTaskId = getStudySessionTaskId(activeSession);
    setActionState('stop');
    setErrorMessage(null);

    try {
      const session = await stopStudySession(activeSession._id, { appSwitchCount });
      const refreshedTasks = stoppingTaskId ? await getTasks() : null;

      startTransition(() => {
        setActiveSession(null);
        setSessions((currentSessions) => mergeSessionRecord(currentSessions, session));
        setPendingReflectionSession(session);
        if (refreshedTasks) {
          setTasks(refreshedTasks);
        }
      });
    } catch (error) {
      console.error('Error stopping session:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to stop the study session.');
    } finally {
      setActionState(null);
    }
  };

  const handleEndTask = async () => {
    const taskId = getStudySessionTaskId(activeSession);
    if (!taskId) return;

    setActionState('complete');
    setErrorMessage(null);

    try {
      let stoppedSession: StudySession | null = null;

      if (activeSession && getStudySessionStatus(activeSession) !== 'completed') {
        stoppedSession = await stopStudySession(activeSession._id, { appSwitchCount });
      }

      await completeTask(taskId);
      const refreshedTasks = await getTasks();

      startTransition(() => {
        setActiveSession(null);
        if (stoppedSession) {
          setSessions((currentSessions) => mergeSessionRecord(currentSessions, stoppedSession));
          setPendingReflectionSession(stoppedSession);
        }
        setTasks(refreshedTasks);
      });
    } catch (error) {
      console.error('Error ending task:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to end the task.');
    } finally {
      setActionState(null);
    }
  };

  const handleReflectionSave = async (distractionTag: DistractionTag) => {
    if (!pendingReflectionSession) {
      return;
    }

    setReflectionSaving(true);
    setErrorMessage(null);

    try {
      const session = await updateStudySessionReflection(pendingReflectionSession._id, distractionTag);

      startTransition(() => {
        setSessions((currentSessions) => mergeSessionRecord(currentSessions, session));
        setPendingReflectionSession(null);
      });
    } catch (error) {
      console.error('Error saving session reflection:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save the distraction reflection.');
    } finally {
      setReflectionSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-[var(--foreground)]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-sky-400/20 border-t-sky-300" />
          <p className="text-muted text-sm uppercase tracking-[0.22em]">Loading sessions</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {errorMessage ? (
          <div className="flex items-start gap-3 rounded-[26px] border border-rose-400/20 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{errorMessage}</p>
          </div>
        ) : null}

        {smartAlert ? (
          <div className={`flex items-start gap-3 rounded-[26px] border px-4 py-4 text-sm ${getAlertToneClasses(smartAlert.tone)}`}>
            <BellRing className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{smartAlert.message}</p>
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-4">
          <DashboardCard
            title="Total sessions"
            value={`${sessions.length}`}
            description="All tracked study blocks recorded so far."
            icon={<Clock3 className="h-5 w-5" />}
            eyebrow="History"
            accent="blue"
          />
          <DashboardCard
            title="Tracked time"
            value={formatMinutes(totalMinutes)}
            description="Combined focused time from completed sessions."
            icon={<Timer className="h-5 w-5" />}
            eyebrow="Duration"
            accent="emerald"
          />
          <DashboardCard
            title="Average productivity"
            value={formatPercent(averageProductivity)}
            description="Session completion score based on actual time versus planned time."
            icon={<Flame className="h-5 w-5" />}
            eyebrow="Score"
            accent="amber"
          />
          <DashboardCard
            title="Distraction flags"
            value={`${distractedSessions}`}
            description={
              activeSession
                ? activeSessionStatus === 'paused'
                  ? 'A live session is paused and ready to resume.'
                  : `Live session running${focusModeEnabled ? ' with Focus Mode on.' : '.'}`
                : focusModeEnabled
                  ? 'Focus Mode is armed for your next session.'
                  : 'No live session right now.'
            }
            icon={<PlayCircle className="h-5 w-5" />}
            eyebrow="Live Status"
            accent="violet"
          />
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <ChartSection title="Active Session" description="Track the current block, watch for drift, and keep the study timer visible.">
            <div className="surface-card-soft rounded-3xl p-4 sm:p-6">
              {activeSession ? (
                <SessionTimer
                  session={{ ...activeSession, appSwitchCount }}
                  taskTitle={activeTask.title}
                  taskSubject={activeTask.subject}
                  onPause={handlePause}
                  onResume={handleResume}
                  onStop={handleSessionStop}
                  onEndTask={handleEndTask}
                  actionState={actionState}
                  focusModeEnabled={focusModeEnabled}
                  recommendedBreakMinutes={settings.studyPreferences.breakMinutes}
                />
              ) : (
                <div className="py-12 text-center">
                  <p className="text-primary text-lg font-medium">No active session</p>
                  <p className="text-tertiary mt-2 text-sm">
                    Start a {selectedPlanMinutes}-minute task-linked session to begin live tracking.
                  </p>
                </div>
              )}
            </div>
          </ChartSection>

          <ChartSection title="Quick Start" description="Pick a focus block length, turn on Focus Mode, and launch a session from an active task.">
            <div className="space-y-4">
              <div className="surface-card-soft rounded-3xl p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <p className="text-primary text-sm font-medium">Planned focus block</p>
                    <p className="text-tertiary text-sm">
                      New sessions will target {selectedPlanMinutes} focused minute{selectedPlanMinutes === 1 ? '' : 's'}.
                    </p>
                    <p className="text-muted text-xs uppercase tracking-[0.18em]">
                      Recommended break: {settings.studyPreferences.breakMinutes} minute
                      {settings.studyPreferences.breakMinutes === 1 ? '' : 's'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {PLAN_PRESETS.map((minutes) => (
                        <button
                          key={minutes}
                          type="button"
                          onClick={() => updateSettings({ studyPreferences: { defaultSessionMinutes: minutes } })}
                          className={`rounded-full border px-3 py-1.5 text-sm ${
                            selectedPlanMinutes === minutes
                              ? 'border-sky-300/40 bg-sky-500/15 text-sky-100'
                              : 'border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text-secondary)] hover:border-sky-400/20 hover:text-[var(--foreground)]'
                          }`}
                        >
                          {minutes}m
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void toggleFocusMode();
                    }}
                    className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium ${
                      focusModeEnabled
                        ? 'border-sky-300/30 bg-sky-500/15 text-sky-100'
                        : 'border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text-secondary)] hover:border-sky-400/20 hover:text-[var(--foreground)]'
                    }`}
                  >
                    {focusModeEnabled ? <Shield className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    {focusModeEnabled ? 'Disable Focus Mode' : 'Enable Focus Mode'}
                  </button>
                </div>
              </div>

              {quickStartTasks.length ? (
                quickStartTasks.map((task) => {
                  const isCurrentTask = activeTaskId === task._id;
                  const shouldResume = isCurrentTask && activeSessionStatus === 'paused';
                  const isDisabled =
                    (!!activeSession && !isCurrentTask) ||
                    !!startingTaskId ||
                    (isCurrentTask && activeSessionStatus === 'active');

                  return (
                    <button
                      key={task._id}
                      onClick={() => {
                        if (shouldResume) {
                          void handleResume();
                          return;
                        }

                        void handleSessionStart(task._id);
                      }}
                      disabled={isDisabled}
                      className="surface-card-soft flex w-full flex-col items-start gap-3 rounded-3xl px-5 py-4 text-left transition-all duration-300 hover:border-sky-400/20 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-primary font-medium">{task.title}</p>
                        <p className="text-tertiary text-sm">{task.subject}</p>
                      </div>
                      <span className="self-end text-sm text-sky-200 sm:self-auto">
                        {startingTaskId === task._id
                          ? 'Starting...'
                          : isCurrentTask
                            ? activeSessionStatus === 'paused'
                              ? 'Resume'
                              : 'Running'
                            : `Start ${selectedPlanMinutes}m`}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="surface-card-soft text-tertiary rounded-3xl border-dashed px-6 py-12 text-center">
                  Add tasks first to launch a tracked study session.
                </div>
              )}
            </div>
          </ChartSection>
        </div>

        {pendingReflectionSession ? (
          <ChartSection
            title="Session Review"
            description="Capture what pulled your attention so the analytics can learn your distraction patterns."
            action={<MonitorUp className="h-5 w-5 text-sky-200" />}
          >
            <div className="space-y-4">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Latest session</p>
                    <p className="mt-2 text-lg font-medium text-white">
                      {formatMinutes(pendingReflectionSession.actualDurationMinutes ?? pendingReflectionSession.durationMinutes)} of{' '}
                      {formatMinutes(pendingReflectionSession.plannedDurationMinutes ?? selectedPlanMinutes)} planned
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      Productivity score {formatPercent(pendingReflectionSession.productivityScore ?? 0)}.
                    </p>
                  </div>
                  <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${getProductivityTone(pendingReflectionSession.productivityScore)}`}>
                    {pendingReflectionSession.productivityLabel ?? 'Needs improvement'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {DISTRACTION_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={reflectionSaving}
                    onClick={() => {
                      void handleReflectionSave(option.value);
                    }}
                    className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-left transition-all duration-300 hover:border-sky-400/20 hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <p className="text-lg">{option.emoji}</p>
                    <p className="mt-3 font-medium text-white">{option.label}</p>
                    <p className="mt-1 text-sm text-slate-400">Save this as the main distraction for the session.</p>
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  disabled={reflectionSaving}
                  onClick={() => {
                    void handleReflectionSave(null);
                  }}
                  className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-100 transition-all duration-300 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {reflectionSaving ? 'Saving...' : 'Stayed focused'}
                </button>
                <button
                  type="button"
                  disabled={reflectionSaving}
                  onClick={() => setPendingReflectionSession(null)}
                  className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-slate-200 transition-all duration-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Ask me later
                </button>
              </div>
            </div>
          </ChartSection>
        ) : null}

        <ChartSection title="Recent Sessions" description="Review your latest focus blocks, productivity scores, and distraction tags.">
          <div className="space-y-4">
            {sessions.length ? (
              sessions.slice(0, 10).map((session) => {
                const taskMeta = getTaskMeta(session);

                return (
                  <div key={session._id} className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-white">{taskMeta.title}</p>
                        <span className="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                          {getSessionStateLabel(session)}
                        </span>
                        {session.distractionDetected ? (
                          <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-amber-100">
                            Distraction detected
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-slate-400">
                        {new Date(session.startTime).toLocaleDateString()} |{' '}
                        {formatMinutes(session.actualDurationMinutes ?? session.durationMinutes)} focus from{' '}
                        {formatMinutes(session.plannedDurationMinutes ?? 0)} planned
                      </p>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                        <span className={`rounded-full border px-2 py-1 ${getProductivityTone(session.productivityScore)}`}>
                          {formatPercent(session.productivityScore ?? 0)} productivity
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/8 px-2 py-1">
                          {session.pauseCount ?? 0} pause{session.pauseCount === 1 ? '' : 's'}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/8 px-2 py-1">
                          {session.appSwitchCount ?? 0} app switch{session.appSwitchCount === 1 ? '' : 'es'}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/8 px-2 py-1">
                          {formatDistractionTag(session.distractionTag)}
                        </span>
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-sm text-slate-400">
                        {new Date(session.startTime).toLocaleTimeString()} -{' '}
                        {session.endTime
                          ? new Date(session.endTime).toLocaleTimeString()
                          : getStudySessionStatus(session) === 'paused'
                            ? 'Paused'
                            : 'In progress'}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        Lost focus time: {formatMinutes(session.distractionTimeMinutes ?? 0)}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-3xl border border-dashed border-white/12 bg-white/4 px-6 py-12 text-center text-slate-400">
                Session history appears here after you complete your first tracked block.
              </div>
            )}
          </div>
        </ChartSection>
      </div>
    </AppShell>
  );
}
