import { fetchJson } from '@/lib/api';
import type { StudySession } from '@/lib/sessionApi';

export interface TaskRecord {
  _id: string;
  title: string;
  subject: string;
  progress: number;
  priority: number;
  difficulty?: number;
  isHidden?: boolean;
  status: 'pending' | 'in-progress' | 'completed' | string;
  expectedStudyMinutes?: number;
  totalStudyTime?: number;
  realStudyMinutes?: number;
  lastStudiedAt?: string;
  sessionHistory?: StudySession[];
}

export interface CreateTaskInput {
  title: string;
  subject: string;
  expectedStudyMinutes: number;
  difficulty: number;
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {
  status?: TaskRecord['status'];
  progress?: number;
  isHidden?: boolean;
}

export function getTasks() {
  return fetchJson<TaskRecord[]>('/tasks');
}

export function createTask(task: CreateTaskInput) {
  return fetchJson<TaskRecord>('/tasks', {
    method: 'POST',
    body: JSON.stringify(task),
  });
}

export function updateTask(taskId: string, updates: UpdateTaskInput) {
  return fetchJson<TaskRecord>(`/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export function completeTask(taskId: string) {
  return updateTask(taskId, { status: 'completed' });
}

export function deleteTask(taskId: string) {
  return fetchJson<{ message: string }>(`/tasks/${taskId}`, {
    method: 'DELETE',
  });
}
