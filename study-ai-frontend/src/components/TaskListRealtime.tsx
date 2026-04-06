'use client';

export { default } from '@/components/TaskListRealtimeOptimized';

/*
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChartSection from '@/components/ChartSection';
import TaskCreateForm from '@/components/TaskCreateForm';
import TaskCard from '@/components/TaskCardRealtime';
import { fetchJson } from '@/lib/api';
import { formatPercent } from '@/lib/format';
import {
  getActiveStudySession,
  getStudySessionStatus,
  getStudySessionTaskId,
  pauseStudySession,
  resumeStudySession,
  startStudySession,
  stopStudySession,
  type StudySession,
} from '@/lib/sessionApi';
import { getStudySessionStoredPausedMs } from '@/lib/sessionTimer';
import { createTask as createTaskRequest, type CreateTaskInput, type TaskRecord, getTasks } from '@/lib/taskApi';
import { Plus } from 'lucide-react';

type Task = TaskRecord;
type SessionAction = 'start' | 'pause' | 'resume' | 'stop' | 'end' | 'delete';

interface TaskListProps {
  onTaskUpdate: () => void;
}
*/

/*
const MINUTE_MS = 60_000;

const getSessionTimestamp = (session: StudySession | null) => {
  if (!session) return 0;

  for (const value of [session.updatedAt, session.endTime, session.pausedAt, session.startTime]) {
    if (!value) continue;

    const timestamp = new Date(value).getTime();
    if (!Number.isNaN(timestamp)) {
      return timestamp;
    }
  }

  return 0;
};

const getLatestTaskSession = (task: Task) => {
  const sessionHistory = task.sessionHistory ?? [];

  if (!sessionHistory.length) {
    return null;
  }

  return sessionHistory.reduce<StudySession | null>((latestSession, session) => {
    if (!latestSession) {
      return session;
    }

    return getSessionTimestamp(session) >= getSessionTimestamp(latestSession) ? session : latestSession;
  }, null);
};

const getMoreRecentSession = (first: StudySession | null, second: StudySession | null) => {
  if (!first) return second;
  if (!second) return first;
  return getSessionTimestamp(second) >= getSessionTimestamp(first) ? second : first;
};

const createOptimisticSession = (taskId: string, overrides: Partial<StudySession> = {}): StudySession => {
  const timestamp = new Date().toISOString();

  return {
    _id: `optimistic-${taskId}`,
    taskId,
    startTime: timestamp,
    durationMinutes: 0,
    trackedMinutes: 0,
    status: 'active',
    isPaused: false,
    pausedAt: null,
    totalPausedMs: 0,
    totalPausedTime: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
};

const createPausedSnapshot = (session: StudySession): StudySession => {
  const pausedAt = new Date().toISOString();

  return {
    ...session,
    status: 'paused',
    isPaused: true,
    pausedAt,
    updatedAt: pausedAt,
  };
};

const createResumedSnapshot = (session: StudySession): StudySession => {
  const resumedAt = new Date();
  const pausedAtTimestamp = session.pausedAt ? new Date(session.pausedAt).getTime() : NaN;
  const totalPausedMs =
    Number.isNaN(pausedAtTimestamp) || pausedAtTimestamp <= 0
      ? getStudySessionStoredPausedMs(session)
      : getStudySessionStoredPausedMs(session) + Math.max(0, resumedAt.getTime() - pausedAtTimestamp);

  return {
    ...session,
    status: 'active',
    isPaused: false,
    pausedAt: null,
    totalPausedMs,
    totalPausedTime: Math.floor(totalPausedMs / MINUTE_MS),
    updatedAt: resumedAt.toISOString(),
  };
};

const createStoppedSnapshot = (session: StudySession): StudySession => {
  const stoppedAt = new Date();
  const pausedAtTimestamp = session.pausedAt ? new Date(session.pausedAt).getTime() : NaN;
  const totalPausedMs =
    Number.isNaN(pausedAtTimestamp) || pausedAtTimestamp <= 0
      ? getStudySessionStoredPausedMs(session)
      : getStudySessionStoredPausedMs(session) + Math.max(0, stoppedAt.getTime() - pausedAtTimestamp);

  return {
    ...session,
    endTime: stoppedAt.toISOString(),
    status: 'completed',
    isPaused: false,
    pausedAt: null,
    totalPausedMs,
    totalPausedTime: Math.floor(totalPausedMs / MINUTE_MS),
    updatedAt: stoppedAt.toISOString(),
  };
};

const getPriorityColor = (priority: number) => {
  if (priority >= 80) return 'text-rose-200';
  if (priority >= 60) return 'text-amber-200';
  if (priority >= 40) return 'text-sky-200';
  return 'text-emerald-200';
};

export default function TaskListRealtime({ onTaskUpdate }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeSession, setActiveSession] = useState<StudySession | null>(null);
  const [sessionSnapshots, setSessionSnapshots] = useState<Record<string, StudySession | null>>({});
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ taskId: string; action: SessionAction } | null>(null);
  const taskSessionMapRef = useRef<Record<string, StudySession | null>>({});
  const openSessionTaskIdRef = useRef<string | null>(null);

  const taskSessionMap = useMemo(() => {
    return tasks.reduce<Record<string, StudySession | null>>((sessionMap, task) => {
      const sessionFromHistory = getLatestTaskSession(task);
      const sessionFromSnapshot = sessionSnapshots[task._id] ?? null;
      const sessionFromActive = getStudySessionTaskId(activeSession) === task._id ? activeSession : null;

      sessionMap[task._id] = getMoreRecentSession(getMoreRecentSession(sessionFromHistory, sessionFromSnapshot), sessionFromActive);
      return sessionMap;
    }, {});
  }, [activeSession, sessionSnapshots, tasks]);

  const openSessionTaskId =
    activeSession && getStudySessionStatus(activeSession) !== 'completed' ? getStudySessionTaskId(activeSession) : null;
  const isSessionMutating = pendingAction !== null;
  const taskStats = useMemo(() => {
    const completedCount = tasks.filter((task) => task.status === 'completed').length;
    const averageProgress = tasks.length ? tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length : 0;

    return {
      totalCount: tasks.length,
      completedCount,
      averageProgress,
    };
  }, [tasks]);

  useEffect(() => {
    taskSessionMapRef.current = taskSessionMap;
  }, [taskSessionMap]);

  useEffect(() => {
    openSessionTaskIdRef.current = openSessionTaskId;
  }, [openSessionTaskId]);

  const applyTaskData = useCallback((taskData: Task[], currentSession: StudySession | null) => {
    startTransition(() => {
      setTasks(taskData);
      setActiveSession(currentSession);
    });
  }, []);

  const refreshData = useCallback(async () => {
    const [taskData, currentSession] = await Promise.all([getTasks(), getActiveStudySession()]);
    applyTaskData(taskData, currentSession);
  }, [applyTaskData]);

  const refreshDataSafely = useCallback(async () => {
    try {
      await refreshData();
    } catch (error) {
      console.error('Failed to refresh task and session data:', error);
    }
  }, [refreshData]);

  const setTaskSessionSnapshot = useCallback((taskId: string, session: StudySession | null) => {
    setSessionSnapshots((currentSnapshots) => ({
      ...currentSnapshots,
      [taskId]: session,
    }));
  }, []);

  const clearTaskSessionSnapshot = useCallback((taskId: string) => {
    setSessionSnapshots((currentSnapshots) => {
      if (!(taskId in currentSnapshots)) {
        return currentSnapshots;
      }

      const nextSnapshots = { ...currentSnapshots };
      delete nextSnapshots[taskId];
      return nextSnapshots;
    });
  }, []);

  const getTaskActionState = useCallback(
    (taskId: string) => (pendingAction?.taskId === taskId ? pendingAction.action : null),
    [pendingAction],
  );

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);

      try {
        const [taskData, currentSession] = await Promise.all([getTasks(), getActiveStudySession()]);

        if (cancelled) {
          return;
        }

        applyTaskData(taskData, currentSession);
        setSessionError(null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error('Error loading tasks or session:', error);
        setSessionError(error instanceof Error ? error.message : 'Failed to load tasks.');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [applyTaskData]);

  const toggleCreateForm = useCallback(() => {
    setShowCreateForm((open) => !open);
  }, []);

  const closeCreateForm = useCallback(() => {
    setShowCreateForm(false);
  }, []);

  const handleCreateTask = useCallback(
    async (taskInput: CreateTaskInput) => {
      setSessionError(null);

      try {
        await createTaskRequest(taskInput);
        await refreshData();
        setShowCreateForm(false);
        onTaskUpdate();
      } catch (error) {
        console.error('Failed to create task:', error);
        setSessionError(error instanceof Error ? error.message : 'Failed to create task.');
        throw error;
      }
    },
    [onTaskUpdate, refreshData],
  );

  const handleSessionStart = useCallback(
    async (taskId: string) => {
      setPendingAction({ taskId, action: 'start' });
      setSessionError(null);
      const optimisticSession = createOptimisticSession(taskId);
      setTaskSessionSnapshot(taskId, optimisticSession);
      setActiveSession(optimisticSession);

      try {
        const session = await startStudySession(taskId);
        setTaskSessionSnapshot(taskId, session);
        setActiveSession(session);
        await refreshDataSafely();
        onTaskUpdate();
      } catch (error) {
        clearTaskSessionSnapshot(taskId);
        setActiveSession(null);
        await refreshDataSafely();
        console.error('Failed to start session:', error);
        setSessionError(error instanceof Error ? error.message : 'Failed to start session.');
      } finally {
        setPendingAction(null);
      }
    },
    [clearTaskSessionSnapshot, onTaskUpdate, refreshDataSafely, setTaskSessionSnapshot],
  );

  const handlePause = useCallback(
    async (taskId: string) => {
      const taskSession = taskSessionMapRef.current[taskId];

      if (!taskSession || getStudySessionStatus(taskSession) !== 'active') {
        return;
      }

      setPendingAction({ taskId, action: 'pause' });
      setSessionError(null);
      const optimisticSession = createPausedSnapshot(taskSession);
      setTaskSessionSnapshot(taskId, optimisticSession);
      setActiveSession(optimisticSession);

      try {
        const session = await pauseStudySession(taskSession._id);
        setTaskSessionSnapshot(taskId, session);
        setActiveSession(session);
        await refreshDataSafely();
      } catch (error) {
        setTaskSessionSnapshot(taskId, taskSession);
        setActiveSession(taskSession);
        await refreshDataSafely();
        console.error('Failed to pause session:', error);
        setSessionError(error instanceof Error ? error.message : 'Failed to pause session.');
      } finally {
        setPendingAction(null);
      }
    },
    [refreshDataSafely, setTaskSessionSnapshot],
  );

  const handleResume = useCallback(
    async (taskId: string) => {
      const taskSession = taskSessionMapRef.current[taskId];

      if (!taskSession || getStudySessionStatus(taskSession) !== 'paused') {
        return;
      }

      setPendingAction({ taskId, action: 'resume' });
      setSessionError(null);
      const optimisticSession = createResumedSnapshot(taskSession);
      setTaskSessionSnapshot(taskId, optimisticSession);
      setActiveSession(optimisticSession);

      try {
        const session = await resumeStudySession(taskSession._id);
        setTaskSessionSnapshot(taskId, session);
        setActiveSession(session);
        await refreshDataSafely();
        onTaskUpdate();
      } catch (error) {
        setTaskSessionSnapshot(taskId, taskSession);
        setActiveSession(taskSession);
        await refreshDataSafely();
        console.error('Failed to resume session:', error);
        setSessionError(error instanceof Error ? error.message : 'Failed to resume session.');
      } finally {
        setPendingAction(null);
      }
    },
    [onTaskUpdate, refreshDataSafely, setTaskSessionSnapshot],
  );

  const handleStop = useCallback(
    async (taskId: string) => {
      const taskSession = taskSessionMapRef.current[taskId];

      if (!taskSession) {
        return;
      }

      setPendingAction({ taskId, action: 'stop' });
      setSessionError(null);
      const optimisticSession = createStoppedSnapshot(taskSession);
      setTaskSessionSnapshot(taskId, optimisticSession);
      setActiveSession(optimisticSession);

      try {
        const session = await stopStudySession(taskSession._id);
        setTaskSessionSnapshot(taskId, session);
        setActiveSession(null);
        await refreshDataSafely();
        onTaskUpdate();
      } catch (error) {
        setTaskSessionSnapshot(taskId, taskSession);
        setActiveSession(taskSession);
        await refreshDataSafely();
        console.error('Failed to stop session:', error);
        setSessionError(error instanceof Error ? error.message : 'Failed to stop session.');
      } finally {
        setPendingAction(null);
      }
    },
    [onTaskUpdate, refreshDataSafely, setTaskSessionSnapshot],
  );

  const handleEndTask = useCallback(
    async (taskId: string) => {
      const taskSession = taskSessionMapRef.current[taskId];

      setPendingAction({ taskId, action: 'end' });
      setSessionError(null);

      try {
        if (taskSession && getStudySessionStatus(taskSession) !== 'completed') {
          const optimisticSession = createStoppedSnapshot(taskSession);
          setTaskSessionSnapshot(taskId, optimisticSession);
          setActiveSession(optimisticSession);
          const stoppedSession = await stopStudySession(taskSession._id);
          setTaskSessionSnapshot(taskId, stoppedSession);
          setActiveSession(null);
        }

        await fetchJson<Task>(`/tasks/${taskId}`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'completed', progress: 100 }),
        });

        await refreshDataSafely();
        onTaskUpdate();
      } catch (error) {
        if (taskSession) {
          setTaskSessionSnapshot(taskId, taskSession);
          setActiveSession(taskSession);
        }
        await refreshDataSafely();
        console.error('Failed to end task:', error);
        setSessionError(error instanceof Error ? error.message : 'Failed to end task.');
      } finally {
        setPendingAction(null);
      }
    },
    [onTaskUpdate, refreshDataSafely, setTaskSessionSnapshot],
  );

  const handleDelete = useCallback(
    async (taskId: string) => {
      if (!window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
        return;
      }

      const taskSession = taskSessionMapRef.current[taskId];
      setPendingAction({ taskId, action: 'delete' });
      setSessionError(null);

      try {
        if (taskSession && getStudySessionStatus(taskSession) !== 'completed') {
          await stopStudySession(taskSession._id);
          setActiveSession(null);
        }

        await fetchJson(`/tasks/${taskId}`, {
          method: 'DELETE',
        });

        startTransition(() => {
          setTasks((currentTasks) => currentTasks.filter((task) => task._id !== taskId));
          if (openSessionTaskIdRef.current === taskId) {
            setActiveSession(null);
          }
        });

        clearTaskSessionSnapshot(taskId);
        await refreshDataSafely();
        onTaskUpdate();
      } catch (error) {
        await refreshDataSafely();
        console.error('Failed to delete task:', error);
        setSessionError(error instanceof Error ? error.message : 'Failed to delete task.');
      } finally {
        setPendingAction(null);
      }
    },
    [clearTaskSessionSnapshot, onTaskUpdate, refreshDataSafely],
  );

  if (loading) {
    return (
      <ChartSection title="Tasks" description="Loading your active study queue.">
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-[26px] border border-white/10 bg-white/5" />
          ))}
        </div>
      </ChartSection>
    );
  }

  return (
    <ChartSection
      title="Tasks"
      description="Organize study goals, launch sessions quickly, and keep completion visible at a glance."
      action={
        <button
          onClick={toggleCreateForm}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-400/20 bg-sky-500/15 px-4 py-3 text-sm font-medium text-sky-100 transition-all duration-300 hover:-translate-y-0.5 hover:bg-sky-500/25 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Add task
        </button>
      }
    >
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">Active tasks</p>
          <p className="mt-2 text-2xl font-semibold text-white">{taskStats.totalCount}</p>
        </div>
        <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">Completed</p>
          <p className="mt-2 text-2xl font-semibold text-white">{taskStats.completedCount}</p>
        </div>
        <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">Average progress</p>
          <p className="mt-2 text-2xl font-semibold text-white">{formatPercent(taskStats.averageProgress)}</p>
        </div>
      </div>

      {showCreateForm ? <TaskCreateForm onSubmitTask={handleCreateTask} onCancel={closeCreateForm} /> : null}

      {sessionError ? (
        <div className="mb-4 rounded-[22px] border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {sessionError}
        </div>
      ) : null}

      <div className="space-y-4">
        {tasks.length === 0 ? (
          <div className="rounded-[26px] border border-dashed border-white/12 bg-white/4 px-6 py-12 text-center">
            <p className="text-lg font-medium text-white">No tasks yet</p>
            <p className="mt-2 text-sm text-slate-400">Create your first task to start building a focused study rhythm.</p>
          </div>
        ) : (
          tasks.map((task) => (
            <div key={task._id}>
              <TaskCard
                task={task}
                session={taskSessionMap[task._id] ?? null}
                hasOtherOpenSession={Boolean(openSessionTaskId && openSessionTaskId !== task._id)}
                isSessionMutating={isSessionMutating}
                onStart={handleSessionStart}
                onPause={handlePause}
                onResume={handleResume}
                onStop={handleStop}
                onEndTask={handleEndTask}
                onDelete={handleDelete}
                actionState={getTaskActionState(task._id)}
              />
              <p className={`mt-2 px-2 text-xs uppercase tracking-[0.22em] ${getPriorityColor(task.priority)}`}>
                Priority signal {Math.round(task.priority)}
              </p>
            </div>
          ))
        )}
      </div>
    </ChartSection>
  );
}
*/
