'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';
import ChartSection from '@/components/ChartSection';
import { useSettings } from '@/components/SettingsProvider';
import TaskCreateForm from '@/components/TaskCreateForm';
import TaskCard from '@/components/TaskCardRealtime';
import { formatPercent } from '@/lib/format';
import {
  getActiveStudySession,
  getStudySessionStatus,
  getStudySessionTaskId,
  pauseStudySession,
  resumeStudySession,
  startStudySessionWithPlan,
  stopStudySession,
  type StudySession,
} from '@/lib/sessionApi';
import {
  createTask as createTaskRequest,
  type CreateTaskInput,
  deleteTask as deleteTaskRequest,
  getTasks,
  type TaskRecord,
  updateTask as updateTaskRequest,
} from '@/lib/taskApi';
import { Eye, EyeOff, Plus } from 'lucide-react';

type Task = TaskRecord;
type TaskMutationAction = 'start' | 'pause' | 'resume' | 'stop' | 'end' | 'delete' | 'update' | 'hide';
type ActiveFormState = { mode: 'create' } | { mode: 'edit'; taskId: string } | null;

interface TaskListProps {
  onTaskUpdate: () => void;
}

const getSessionTimestamp = (session: StudySession | null) => {
  if (!session) return 0;

  for (const value of [session.updatedAt, session.endTime, session.pausedAt, session.startTime]) {
    if (!value) {
      continue;
    }

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

const getPriorityColor = (priority: number) => {
  if (priority >= 80) return 'text-rose-200';
  if (priority >= 60) return 'text-amber-200';
  if (priority >= 40) return 'text-sky-200';
  return 'text-emerald-200';
};

export default function TaskListRealtimeOptimized({ onTaskUpdate }: TaskListProps) {
  const { settings } = useSettings();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeSession, setActiveSession] = useState<StudySession | null>(null);
  const [sessionSnapshots, setSessionSnapshots] = useState<Record<string, StudySession | null>>({});
  const [loading, setLoading] = useState(true);
  const [activeForm, setActiveForm] = useState<ActiveFormState>(null);
  const [showHiddenTasks, setShowHiddenTasks] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ taskId: string; action: TaskMutationAction } | null>(null);

  const loadTaskAndSessionState = async () => {
    const [taskData, currentSession] = await Promise.all([getTasks(), getActiveStudySession()]);

    startTransition(() => {
      setTasks(taskData);
      setActiveSession(currentSession);
    });

    return { taskData, currentSession };
  };

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);

      try {
        const [taskData, currentSession] = await Promise.all([getTasks(), getActiveStudySession()]);

        if (cancelled) {
          return;
        }

        startTransition(() => {
          setTasks(taskData);
          setActiveSession(currentSession);
        });
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
  }, []);

  const { taskSessionMap, completedCount, averageProgress, visibleTasks, hiddenTasks } = useMemo(() => {
    const sessionMap: Record<string, StudySession | null> = {};
    let completedTaskCount = 0;
    let totalProgress = 0;
    const nextVisibleTasks: Task[] = [];
    const nextHiddenTasks: Task[] = [];

    for (const task of tasks) {
      if (!task.isHidden && task.status === 'completed') {
        completedTaskCount += 1;
      }

      if (!task.isHidden) {
        totalProgress += task.progress;
        nextVisibleTasks.push(task);
      } else {
        nextHiddenTasks.push(task);
      }

      const sessionFromHistory = getLatestTaskSession(task);
      const sessionFromSnapshot = sessionSnapshots[task._id] ?? null;
      const sessionFromActive = getStudySessionTaskId(activeSession) === task._id ? activeSession : null;
      sessionMap[task._id] = getMoreRecentSession(getMoreRecentSession(sessionFromHistory, sessionFromSnapshot), sessionFromActive);
    }

      return {
        taskSessionMap: sessionMap,
        completedCount: completedTaskCount,
        averageProgress: nextVisibleTasks.length ? totalProgress / nextVisibleTasks.length : 0,
        visibleTasks: nextVisibleTasks,
        hiddenTasks: nextHiddenTasks,
      };
    }, [activeSession, sessionSnapshots, tasks]);

  const openSessionTaskId =
    activeSession && getStudySessionStatus(activeSession) !== 'completed' ? getStudySessionTaskId(activeSession) : null;
  const isSessionMutating = pendingAction !== null;

  const setTaskSessionSnapshot = (taskId: string, session: StudySession | null) => {
    setSessionSnapshots((currentSnapshots) => ({
      ...currentSnapshots,
      [taskId]: session,
    }));
  };

  const clearTaskSessionSnapshot = (taskId: string) => {
    setSessionSnapshots((currentSnapshots) => {
      if (!(taskId in currentSnapshots)) {
        return currentSnapshots;
      }

      const nextSnapshots = { ...currentSnapshots };
      delete nextSnapshots[taskId];
      return nextSnapshots;
    });
  };

  const handleCreateTask = async (taskInput: CreateTaskInput) => {
    setSessionError(null);

    try {
      const createdTask = await createTaskRequest(taskInput);

      startTransition(() => {
        setTasks((currentTasks) => [...currentTasks, createdTask]);
        setActiveForm(null);
      });
      onTaskUpdate();
    } catch (error) {
      console.error('Failed to create task:', error);
      setSessionError(error instanceof Error ? error.message : 'Failed to create task.');
      throw error;
    }
  };

  const handleUpdateTask = async (taskInput: CreateTaskInput) => {
    if (activeForm?.mode !== 'edit') {
      return;
    }

    setPendingAction({ taskId: activeForm.taskId, action: 'update' });
    setSessionError(null);

    try {
      const updatedTask = await updateTaskRequest(activeForm.taskId, taskInput);

      startTransition(() => {
        setTasks((currentTasks) => currentTasks.map((task) => (task._id === updatedTask._id ? updatedTask : task)));
        setActiveForm(null);
      });
      await loadTaskAndSessionState();
      onTaskUpdate();
    } catch (error) {
      console.error('Failed to update task:', error);
      setSessionError(error instanceof Error ? error.message : 'Failed to update task.');
      throw error;
    } finally {
      setPendingAction(null);
    }
  };

  const handleToggleVisibility = async (taskId: string, isHidden: boolean) => {
    setPendingAction({ taskId, action: 'hide' });
    setSessionError(null);

    try {
      const updatedTask = await updateTaskRequest(taskId, { isHidden: !isHidden });

      startTransition(() => {
        setTasks((currentTasks) => currentTasks.map((task) => (task._id === updatedTask._id ? updatedTask : task)));
        if (activeForm?.mode === 'edit' && activeForm.taskId === taskId) {
          setActiveForm(null);
        }
        if (isHidden) {
          setShowHiddenTasks(true);
        }
      });
      await loadTaskAndSessionState();
      onTaskUpdate();
    } catch (error) {
      console.error('Failed to toggle task visibility:', error);
      setSessionError(error instanceof Error ? error.message : 'Failed to update task visibility.');
    } finally {
      setPendingAction(null);
    }
  };

  const handleSessionStart = async (taskId: string) => {
    setPendingAction({ taskId, action: 'start' });
    setSessionError(null);

    try {
      const session = await startStudySessionWithPlan(taskId, settings.studyPreferences.defaultSessionMinutes);
      setTaskSessionSnapshot(taskId, session);

      startTransition(() => {
        setActiveSession(session);
        setTasks((currentTasks) =>
          currentTasks.map((task) =>
            task._id === taskId && task.status !== 'completed' ? { ...task, status: 'in-progress' } : task,
          ),
        );
      });
      onTaskUpdate();
    } catch (error) {
      console.error('Failed to start session:', error);
      setSessionError(error instanceof Error ? error.message : 'Failed to start session.');
    } finally {
      setPendingAction(null);
    }
  };

  const handlePause = async (taskId: string) => {
    const taskSession = taskSessionMap[taskId];

    if (!taskSession || getStudySessionStatus(taskSession) !== 'active') {
      return;
    }

    setPendingAction({ taskId, action: 'pause' });
    setSessionError(null);

    try {
      const session = await pauseStudySession(taskSession._id);
      setTaskSessionSnapshot(taskId, session);
      setActiveSession(session);
    } catch (error) {
      console.error('Failed to pause session:', error);
      setSessionError(error instanceof Error ? error.message : 'Failed to pause session.');
    } finally {
      setPendingAction(null);
    }
  };

  const handleResume = async (taskId: string) => {
    const taskSession = taskSessionMap[taskId];

    if (!taskSession || getStudySessionStatus(taskSession) !== 'paused') {
      return;
    }

    setPendingAction({ taskId, action: 'resume' });
    setSessionError(null);

    try {
      const session = await resumeStudySession(taskSession._id);
      setTaskSessionSnapshot(taskId, session);

      startTransition(() => {
        setActiveSession(session);
        setTasks((currentTasks) =>
          currentTasks.map((task) =>
            task._id === taskId && task.status !== 'completed' ? { ...task, status: 'in-progress' } : task,
          ),
        );
      });
      onTaskUpdate();
    } catch (error) {
      console.error('Failed to resume session:', error);
      setSessionError(error instanceof Error ? error.message : 'Failed to resume session.');
    } finally {
      setPendingAction(null);
    }
  };

  const handleStop = async (taskId: string) => {
    const taskSession = taskSessionMap[taskId];

    if (!taskSession) {
      return;
    }

    setPendingAction({ taskId, action: 'stop' });
    setSessionError(null);

    try {
      const session = await stopStudySession(taskSession._id);
      setTaskSessionSnapshot(taskId, session);

      startTransition(() => {
        setActiveSession(null);
      });
      await loadTaskAndSessionState();
      clearTaskSessionSnapshot(taskId);
      onTaskUpdate();
    } catch (error) {
      console.error('Failed to stop session:', error);
      setSessionError(error instanceof Error ? error.message : 'Failed to stop session.');
    } finally {
      setPendingAction(null);
    }
  };

  const handleEndTask = async (taskId: string) => {
    const taskSession = taskSessionMap[taskId];

    setPendingAction({ taskId, action: 'end' });
    setSessionError(null);

    try {
      if (taskSession && getStudySessionStatus(taskSession) !== 'completed') {
        const stoppedSession = await stopStudySession(taskSession._id);
        setTaskSessionSnapshot(taskId, stoppedSession);

        startTransition(() => {
          setActiveSession(null);
        });
      }

      await updateTaskRequest(taskId, { status: 'completed', progress: 100 });

      await loadTaskAndSessionState();
      clearTaskSessionSnapshot(taskId);
      onTaskUpdate();
    } catch (error) {
      console.error('Failed to end task:', error);
      setSessionError(error instanceof Error ? error.message : 'Failed to end task.');
    } finally {
      setPendingAction(null);
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      return;
    }

    const taskSession = taskSessionMap[taskId];
    setPendingAction({ taskId, action: 'delete' });
    setSessionError(null);

    try {
      if (taskSession && getStudySessionStatus(taskSession) !== 'completed') {
        await stopStudySession(taskSession._id);
      }

      await deleteTaskRequest(taskId);

      clearTaskSessionSnapshot(taskId);
      startTransition(() => {
        setTasks((currentTasks) => currentTasks.filter((task) => task._id !== taskId));
        if (openSessionTaskId === taskId) {
          setActiveSession(null);
        }
      });
      onTaskUpdate();
    } catch (error) {
      console.error('Failed to delete task:', error);
      setSessionError(error instanceof Error ? error.message : 'Failed to delete task.');
    } finally {
      setPendingAction(null);
    }
  };

  if (loading) {
    return (
      <ChartSection title="Tasks" description="Loading your active study queue.">
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="surface-card-soft h-36 animate-pulse rounded-[26px]" />
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
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {hiddenTasks.length ? (
            <button
              type="button"
              onClick={() => setShowHiddenTasks((open) => !open)}
              className="surface-card-soft text-secondary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-400/20"
            >
              {showHiddenTasks ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              {showHiddenTasks ? 'Hide hidden tasks' : `Hidden tasks (${hiddenTasks.length})`}
            </button>
          ) : null}
          <button
            onClick={() => setActiveForm((currentForm) => (currentForm?.mode === 'create' ? null : { mode: 'create' }))}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-400/20 bg-sky-500/15 px-4 py-3 text-sm font-medium text-sky-100 transition-all duration-300 hover:-translate-y-0.5 hover:bg-sky-500/25 sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            {activeForm?.mode === 'create' ? 'Close form' : 'Add task'}
          </button>
        </div>
      }
    >
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="surface-card-soft rounded-[22px] p-4">
          <p className="text-tertiary text-sm">Active tasks</p>
          <p className="text-primary mt-2 text-2xl font-semibold">{visibleTasks.length}</p>
        </div>
        <div className="surface-card-soft rounded-[22px] p-4">
          <p className="text-tertiary text-sm">Completed</p>
          <p className="text-primary mt-2 text-2xl font-semibold">{completedCount}</p>
        </div>
        <div className="surface-card-soft rounded-[22px] p-4">
          <p className="text-tertiary text-sm">Average progress</p>
          <p className="text-primary mt-2 text-2xl font-semibold">{formatPercent(averageProgress)}</p>
        </div>
      </div>

      {activeForm ? (
        <TaskCreateForm
          onSubmitTask={activeForm.mode === 'create' ? handleCreateTask : handleUpdateTask}
          onCancel={() => setActiveForm(null)}
          initialValues={activeForm.mode === 'edit' ? tasks.find((task) => task._id === activeForm.taskId) ?? undefined : undefined}
          title={activeForm.mode === 'create' ? 'Create Task' : 'Edit Task'}
          description={
            activeForm.mode === 'create'
              ? 'Capture the essentials and keep your study queue tight.'
              : 'Update the task details without breaking your existing study history.'
          }
          submitLabel={activeForm.mode === 'create' ? 'Create Task' : 'Save Changes'}
          submittingLabel={activeForm.mode === 'create' ? 'Creating...' : 'Saving...'}
        />
      ) : null}

      {sessionError ? (
        <div className="mb-4 rounded-[22px] border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {sessionError}
        </div>
      ) : null}

      <div className="space-y-4">
        {visibleTasks.length === 0 ? (
          <div className="surface-card-soft rounded-[26px] border-dashed px-6 py-12 text-center">
            <p className="text-primary text-lg font-medium">{hiddenTasks.length ? 'All tasks are hidden' : 'No tasks yet'}</p>
            <p className="text-tertiary mt-2 text-sm">
              {hiddenTasks.length
                ? 'Open the hidden tasks panel to unhide them, or add a fresh task.'
                : 'Create your first task to start building a focused study rhythm.'}
            </p>
          </div>
        ) : (
          visibleTasks.map((task) => (
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
                onEdit={(taskId) => setActiveForm({ mode: 'edit', taskId })}
                onToggleVisibility={handleToggleVisibility}
                actionState={pendingAction?.taskId === task._id ? pendingAction.action : null}
              />
              <p className={`mt-2 px-2 text-xs uppercase tracking-[0.22em] ${getPriorityColor(task.priority)}`}>
                Priority signal {Math.round(task.priority)}
              </p>
            </div>
          ))
        )}
      </div>

      {showHiddenTasks && hiddenTasks.length ? (
        <div className="mt-6 border-t pt-6" style={{ borderColor: 'var(--border)' }}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-muted text-sm uppercase tracking-[0.22em]">Hidden Tasks</p>
              <p className="text-tertiary mt-1 text-sm">Hidden tasks stay saved and can be restored anytime.</p>
            </div>
            <span className="badge-soft rounded-full px-3 py-1 text-xs font-medium">
              {hiddenTasks.length} hidden
            </span>
          </div>
          <div className="space-y-4">
            {hiddenTasks.map((task) => (
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
                  onEdit={(taskId) => setActiveForm({ mode: 'edit', taskId })}
                  onToggleVisibility={handleToggleVisibility}
                  actionState={pendingAction?.taskId === task._id ? pendingAction.action : null}
                />
                <p className={`mt-2 px-2 text-xs uppercase tracking-[0.22em] ${getPriorityColor(task.priority)}`}>
                  Priority signal {Math.round(task.priority)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </ChartSection>
  );
}
