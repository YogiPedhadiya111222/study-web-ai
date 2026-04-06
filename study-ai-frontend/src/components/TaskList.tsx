'use client';

export { default } from '@/components/TaskListRealtime';

/*
'use client';

import { FormEvent, useEffect, useState } from 'react';
import ChartSection from '@/components/ChartSection';
import TaskCard from '@/components/TaskCard';
import { fetchJson } from '@/lib/api';
import { formatPercent } from '@/lib/format';
import {
  getActiveStudySession,
  pauseStudySession,
  resumeStudySession,
  startStudySession,
  stopStudySession,
  type StudySession,
} from '@/lib/sessionApi';
import { Plus } from 'lucide-react';

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

interface TaskListProps {
  onTaskUpdate: () => void;
}
*/

/*
type SessionAction = 'start' | 'pause' | 'resume' | 'stop' | 'end' | 'delete' | null;

export default function TaskList({ onTaskUpdate }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeSession, setActiveSession] = useState<StudySession | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [startingTaskId, setStartingTaskId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<SessionAction>(null);
  const [newTask, setNewTask] = useState({
    title: '',
    subject: '',
    expectedStudyMinutes: 60,
    difficulty: 3,
  });

  const getActiveTaskId = (session: StudySession | null) => {
    if (!session?.taskId) return null;
    return typeof session.taskId === 'object' ? session.taskId._id : session.taskId;
  };

  const isActiveTask = (taskId: string) => getActiveTaskId(activeSession) === taskId;

  const fetchTasks = async () => {
    try {
      const data = await fetchJson<Task[]>('/tasks');
      setTasks(data);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [taskData, currentSession] = await Promise.all([fetchJson<Task[]>('/tasks'), getActiveStudySession()]);
      setTasks(taskData);
      setActiveSession(currentSession);
      setSessionError(null);
    } catch (error) {
      console.error('Error loading tasks or session:', error);
      setSessionError(error instanceof Error ? error.message : 'Failed to load tasks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const refreshSessionState = async () => {
    try {
      const currentSession = await getActiveStudySession();
      setActiveSession(currentSession);
    } catch (error) {
      console.error('Failed to refresh active session:', error);
    }
  };

  const refreshData = async () => {
    await Promise.all([fetchTasks(), refreshSessionState()]);
  };

  const createTask = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetchJson<Task>('/tasks', {
        method: 'POST',
        body: JSON.stringify(newTask),
      });
      setShowCreateForm(false);
      setNewTask({ title: '', subject: '', expectedStudyMinutes: 60, difficulty: 3 });
      await refreshData();
      onTaskUpdate();
    } catch (error) {
      console.error('Failed to create task:', error);
      setSessionError(error instanceof Error ? error.message : 'Failed to create task.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSessionStart = async (taskId: string) => {
    setStartingTaskId(taskId);
    setSessionError(null);
    setActionState('start');

    try {
      const session = await startStudySession(taskId);
      setActiveSession(session);
      await refreshData();
      onTaskUpdate();
    } catch (error) {
      console.error('Failed to start session:', error);
      setSessionError(error instanceof Error ? error.message : 'Failed to start session.');
    } finally {
      setStartingTaskId(null);
      setActionState(null);
    }
  };

  const handlePause = async (taskId: string) => {
    if (!activeSession || !isActiveTask(taskId)) return;
    setActionState('pause');
    setSessionError(null);

    try {
      const session = await pauseStudySession(activeSession._id);
      setActiveSession(session);
      await refreshData();
    } catch (error) {
      console.error('Failed to pause session:', error);
      setSessionError(error instanceof Error ? error.message : 'Failed to pause session.');
    } finally {
      setActionState(null);
    }
  };

  const handleResume = async (taskId: string) => {
    if (!activeSession || !isActiveTask(taskId)) return;
    setActionState('resume');
    setSessionError(null);

    try {
      const session = await resumeStudySession(activeSession._id);
      setActiveSession(session);
      await refreshData();
      onTaskUpdate();
    } catch (error) {
      console.error('Failed to resume session:', error);
      setSessionError(error instanceof Error ? error.message : 'Failed to resume session.');
    } finally {
      setActionState(null);
    }
  };

  const handleStop = async (taskId: string) => {
    if (!activeSession || !isActiveTask(taskId)) return;
    setActionState('stop');
    setSessionError(null);

    try {
      await stopStudySession(activeSession._id);
      await refreshData();
      onTaskUpdate();
    } catch (error) {
      console.error('Failed to stop session:', error);
      setSessionError(error instanceof Error ? error.message : 'Failed to stop session.');
    } finally {
      setActionState(null);
    }
  };

  const handleEndTask = async (taskId: string) => {
    setActionState('end');
    setSessionError(null);

    try {
      if (activeSession && isActiveTask(taskId)) {
        await stopStudySession(activeSession._id);
      }
      await fetchJson<Task>(`/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'completed', progress: 100 }),
      });
      await refreshData();
      onTaskUpdate();
    } catch (error) {
      console.error('Failed to end task:', error);
      setSessionError(error instanceof Error ? error.message : 'Failed to end task.');
    } finally {
      setActionState(null);
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      return;
    }

    setActionState('delete');
    setSessionError(null);

    try {
      if (activeSession && isActiveTask(taskId)) {
        await stopStudySession(activeSession._id);
      }
      await fetchJson(`/tasks/${taskId}`, {
        method: 'DELETE',
      });
      setTasks(tasks.filter(task => task._id !== taskId));
      onTaskUpdate();
    } catch (error) {
      console.error('Failed to delete task:', error);
      setSessionError(error instanceof Error ? error.message : 'Failed to delete task.');
    } finally {
      setActionState(null);
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 80) return 'text-rose-200';
    if (priority >= 60) return 'text-amber-200';
    if (priority >= 40) return 'text-sky-200';
    return 'text-emerald-200';
  };

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

  const completedCount = tasks.filter((task) => task.status === 'completed').length;
  const averageProgress = tasks.length ? tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length : 0;

  return (
    <ChartSection
      title="Tasks"
      description="Organize study goals, launch sessions quickly, and keep completion visible at a glance."
      action={
        <button
          onClick={() => setShowCreateForm((open) => !open)}
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
          <p className="mt-2 text-2xl font-semibold text-white">{tasks.length}</p>
        </div>
        <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">Completed</p>
          <p className="mt-2 text-2xl font-semibold text-white">{completedCount}</p>
        </div>
        <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">Average progress</p>
          <p className="mt-2 text-2xl font-semibold text-white">{formatPercent(averageProgress)}</p>
        </div>
      </div>

      {showCreateForm && (
        <form onSubmit={createTask} className="mb-6 rounded-[26px] border border-white/10 bg-white/6 p-4 backdrop-blur-md sm:p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <input
              type="text"
              placeholder="Task title"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition-colors focus:border-sky-400/35"
              required
            />
            <input
              type="text"
              placeholder="Subject"
              value={newTask.subject}
              onChange={(e) => setNewTask({ ...newTask, subject: e.target.value })}
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition-colors focus:border-sky-400/35"
              required
            />
            <input
              type="number"
              placeholder="Expected minutes"
              value={newTask.expectedStudyMinutes}
              onChange={(e) => setNewTask({ ...newTask, expectedStudyMinutes: parseInt(e.target.value) })}
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition-colors focus:border-sky-400/35"
              min="1"
            />
            <select
              value={newTask.difficulty}
              onChange={(e) => setNewTask({ ...newTask, difficulty: parseInt(e.target.value) })}
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition-colors focus:border-sky-400/35"
            >
              <option value={1}>Easy</option>
              <option value={2}>Medium-Easy</option>
              <option value={3}>Medium</option>
              <option value={4}>Medium-Hard</option>
              <option value={5}>Hard</option>
            </select>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-2xl border border-emerald-400/20 bg-emerald-500/15 px-4 py-3 font-medium text-emerald-100 transition-all duration-300 hover:-translate-y-0.5 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Creating...' : 'Create Task'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 font-medium text-slate-200 transition-all duration-300 hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

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
                activeSession={activeSession}
                onStart={handleSessionStart}
                onPause={handlePause}
                onResume={handleResume}
                onStop={handleStop}
                onEndTask={handleEndTask}
                onDelete={handleDelete}
                isStarting={startingTaskId === task._id}
                actionState={actionState}
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
