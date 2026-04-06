'use client';

export { default } from '@/components/SessionsPageContent';

/*
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import ChartSection from '@/components/ChartSection';
import DashboardCard from '@/components/DashboardCard';
import SessionTimer from '@/components/SessionTimer';
import { formatMinutes } from '@/lib/format';
import { completeTask, getTasks, type TaskRecord } from '@/lib/taskApi';
import {
  getStudySessionStatus,
  getStudySessionTaskId,
  getActiveStudySession,
  getStudySessions,
  pauseStudySession,
  resumeStudySession,
  startStudySession,
  stopStudySession,
  type StudySession,
} from '@/lib/sessionApi';
import { AlertTriangle, Clock3, PlayCircle, Timer } from 'lucide-react';

type SessionAction = 'pause' | 'resume' | 'stop' | 'complete' | null;

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

export default function SessionsPage() {
  const [activeSession, setActiveSession] = useState<StudySession | null>(null);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [startingTaskId, setStartingTaskId] = useState<string | null>(null);
  const [actionState, setActionState] = useState<SessionAction>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshSessionState = async () => {
    const [sessionData, currentSession] = await Promise.all([getStudySessions(), getActiveStudySession()]);
    setSessions(sessionData);
    setActiveSession(currentSession);
  };

  const loadPageData = async (showLoader = false) => {
    if (showLoader) setLoading(true);

    try {
      const [taskData] = await Promise.all([getTasks(), refreshSessionState()]);
      setTasks(taskData);
      setErrorMessage(null);
    } catch (error) {
      console.error('Error loading sessions page:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load session data.');
    } finally {
      if (showLoader) setLoading(false);
    }
  };

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

        if (cancelled) return;

        setTasks(taskData);
        setSessions(sessionData);
        setActiveSession(currentSession);
        setErrorMessage(null);
      } catch (error) {
        if (cancelled) return;
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

  const handleSessionStart = async (taskId: string) => {
    setStartingTaskId(taskId);
    setErrorMessage(null);

    try {
      const session = await startStudySession(taskId);
      setActiveSession(session);
      const [sessionData, taskData] = await Promise.all([getStudySessions(), getTasks()]);
      setSessions(sessionData);
      setTasks(taskData);
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
      setActiveSession(session);
      setSessions(await getStudySessions());
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
      setActiveSession(session);
      setSessions(await getStudySessions());
    } catch (error) {
      console.error('Error resuming session:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to resume the study session.');
    } finally {
      setActionState(null);
    }
  };

  const handleSessionStop = async () => {
    if (!activeSession) return;

    setActionState('stop');
    setErrorMessage(null);

    try {
      await stopStudySession(activeSession._id);
      await loadPageData();
    } catch (error) {
      console.error('Error stopping session:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to stop the study session.');
    } finally {
      setActionState(null);
    }
  };

  const handleEndTask = async () => {
    const activeTaskId = getStudySessionTaskId(activeSession);
    if (!activeTaskId) return;

    setActionState('complete');
    setErrorMessage(null);

    try {
      if (activeSession && getStudySessionStatus(activeSession) !== 'completed') {
        await stopStudySession(activeSession._id);
      }

      await completeTask(activeTaskId);
      await loadPageData();
    } catch (error) {
      console.error('Error ending task:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to end the task.');
    } finally {
      setActionState(null);
    }
  };

  const totalMinutes = sessions.reduce((sum, session) => sum + session.durationMinutes, 0);
  const activeTask = getTaskMeta(activeSession);
  const activeTaskId = getStudySessionTaskId(activeSession);
  const activeSessionStatus = activeSession ? getStudySessionStatus(activeSession) : null;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-sky-400/20 border-t-sky-300" />
          <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Loading sessions</p>
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

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <DashboardCard
            title="Total sessions"
            value={`${sessions.length}`}
            description="All recorded study sessions."
            icon={<Clock3 className="h-5 w-5" />}
            eyebrow="History"
            accent="blue"
          />
          <DashboardCard
            title="Tracked time"
            value={formatMinutes(totalMinutes)}
            description="Combined time from completed sessions."
            icon={<Timer className="h-5 w-5" />}
            eyebrow="Duration"
            accent="emerald"
          />
          <DashboardCard
            title="Active focus"
            value={activeSession ? (activeSessionStatus === 'paused' ? 'Paused' : 'Running') : 'Idle'}
            description={
              activeSession
                ? activeSessionStatus === 'paused'
                  ? 'Your current session is on a break and ready to resume.'
                  : 'A live study session is currently being tracked.'
                : 'Start a new session when you are ready.'
            }
            icon={<PlayCircle className="h-5 w-5" />}
            eyebrow="Status"
            accent="violet"
          />
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <ChartSection title="Active Session" description="A clear timer for the study block you are currently running.">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
              {activeSession ? (
                <SessionTimer
                  session={activeSession}
                  taskTitle={activeTask.title}
                  taskSubject={activeTask.subject}
                  onPause={handlePause}
                  onResume={handleResume}
                  onStop={handleSessionStop}
                  onEndTask={handleEndTask}
                  actionState={actionState}
                />
              ) : (
                <div className="py-12 text-center">
                  <p className="text-lg font-medium text-white">No active session</p>
                  <p className="mt-2 text-sm text-slate-400">Start a task-linked session to begin live tracking.</p>
                </div>
              )}
            </div>
          </ChartSection>

          <ChartSection title="Quick Start" description="Launch a study session from one of your active tasks.">
            <div className="space-y-3">
              {tasks.filter((task) => task.status !== 'completed').length ? (
                tasks.filter((task) => task.status !== 'completed').slice(0, 4).map((task) => {
                  const isCurrentTask = activeTaskId === task._id;
                  const shouldResume = isCurrentTask && activeSessionStatus === 'paused';
                  const isDisabled = (!!activeSession && !isCurrentTask) || !!startingTaskId || (isCurrentTask && activeSessionStatus === 'active');

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
                      className="flex w-full flex-col items-start gap-3 rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-left transition-all duration-300 hover:border-sky-400/20 hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium text-white">{task.title}</p>
                        <p className="text-sm text-slate-400">{task.subject}</p>
                      </div>
                      <span className="self-end text-sm text-sky-200 sm:self-auto">
                        {startingTaskId === task._id
                          ? 'Starting...'
                          : isCurrentTask
                            ? activeSessionStatus === 'paused'
                              ? 'Resume'
                              : 'Running'
                            : 'Start'}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-3xl border border-dashed border-white/12 bg-white/4 px-6 py-12 text-center text-slate-400">
                  Add tasks first to launch a tracked study session.
                </div>
              )}
            </div>
          </ChartSection>
        </div>

        <ChartSection title="Recent Sessions" description="Your latest study sessions, ordered for quick review.">
          <div className="space-y-4">
            {sessions.length ? (
              sessions.slice(0, 10).map((session) => {
                const taskMeta = getTaskMeta(session);

                return (
                  <div key={session._id} className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-white">{taskMeta.title}</p>
                        <span className="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                          {getSessionStateLabel(session)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400">
                        {new Date(session.startTime).toLocaleDateString()} | {formatMinutes(session.durationMinutes)}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-sm text-slate-400">
                        {new Date(session.startTime).toLocaleTimeString()} -{' '}
                        {session.endTime ? new Date(session.endTime).toLocaleTimeString() : getStudySessionStatus(session) === 'paused' ? 'Paused' : 'In progress'}
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
*/
