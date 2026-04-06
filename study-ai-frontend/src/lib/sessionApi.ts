import { fetchJson } from '@/lib/api';

export interface SessionTaskRef {
  _id?: string;
  title?: string;
  subject?: string;
  status?: string;
  expectedStudyMinutes?: number;
}

export type DistractionTag = 'phone' | 'social' | 'sleepy' | 'tired' | 'overthinking' | 'other' | null;

export interface StudySession {
  _id: string;
  taskId?: string | SessionTaskRef | null;
  startTime: string;
  endTime?: string;
  plannedDurationMinutes?: number;
  durationMinutes: number;
  actualDurationMinutes?: number;
  trackedMinutes?: number;
  duration?: number;
  pauseCount?: number;
  appSwitchCount?: number;
  distractionTag?: DistractionTag;
  distractionDetected?: boolean;
  distractionFlags?: string[];
  distractionTimeMinutes?: number;
  productivityScore?: number;
  productivityLabel?: string;
  focusRatio?: number;
  status?: SessionStatus;
  isPaused?: boolean;
  pausedAt?: string | null;
  totalPausedMs?: number;
  totalPausedTime?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type SessionStatus = 'active' | 'paused' | 'completed';

export function getStudySessionStatus(session: Pick<StudySession, 'status' | 'endTime' | 'isPaused'>): SessionStatus {
  if (session.endTime) return 'completed';
  if (session.status) return session.status;
  return session.isPaused ? 'paused' : 'active';
}

export function getStudySessionTaskId(session?: Pick<StudySession, 'taskId'> | null) {
  if (!session?.taskId) return null;
  return typeof session.taskId === 'string' ? session.taskId : session.taskId._id ?? null;
}

export function getStudySessionTrackedMinutes(session?: Pick<StudySession, 'trackedMinutes' | 'durationMinutes'> | null) {
  return Math.max(0, session?.trackedMinutes ?? session?.durationMinutes ?? 0);
}

export function getStudySessionDurationMinutes(
  session?: Pick<StudySession, 'durationMinutes' | 'duration'> | null,
) {
  return Math.max(0, session?.durationMinutes ?? session?.duration ?? 0);
}

export function sumCompletedStudySessionMinutes(
  sessions?: Array<Pick<StudySession, 'durationMinutes' | 'duration' | 'endTime' | 'status' | 'isPaused'>> | null,
) {
  return (sessions ?? []).reduce((sum, session) => {
    if (getStudySessionStatus(session) !== 'completed') {
      return sum;
    }

    return sum + getStudySessionDurationMinutes(session);
  }, 0);
}

export function hasLinkedStudyTask(session?: Pick<StudySession, 'taskId'> | null): session is StudySession {
  return getStudySessionTaskId(session) !== null;
}

export async function getStudySessions() {
  const sessions = await fetchJson<StudySession[]>('/sessions');
  return sessions.filter((session) => hasLinkedStudyTask(session));
}

export async function getActiveStudySession() {
  const session = await fetchJson<StudySession | null>('/sessions/active');
  return hasLinkedStudyTask(session) ? session : null;
}

export function startStudySession(taskId: string) {
  return fetchJson<StudySession>('/sessions/start', {
    method: 'POST',
    body: JSON.stringify({ taskId }),
  });
}

export function startStudySessionWithPlan(taskId: string, plannedDurationMinutes?: number) {
  return fetchJson<StudySession>('/sessions/start', {
    method: 'POST',
    body: JSON.stringify({ taskId, plannedDurationMinutes }),
  });
}

export function pauseStudySession(sessionId: string) {
  return fetchJson<StudySession>('/sessions/pause', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}

export function resumeStudySession(sessionId: string) {
  return fetchJson<StudySession>('/sessions/resume', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}

export function stopStudySession(sessionId: string, options?: { appSwitchCount?: number }) {
  return fetchJson<StudySession>('/sessions/stop', {
    method: 'POST',
    body: JSON.stringify({ sessionId, appSwitchCount: options?.appSwitchCount }),
  });
}

export function updateStudySessionReflection(sessionId: string, distractionTag: DistractionTag) {
  return fetchJson<StudySession>(`/sessions/${sessionId}/reflection`, {
    method: 'PATCH',
    body: JSON.stringify({ distractionTag }),
  });
}
