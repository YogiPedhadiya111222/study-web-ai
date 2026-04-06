import { getStudySessionStatus, type StudySession } from '@/lib/sessionApi';

const SECOND_MS = 1000;
const MINUTE_MS = SECOND_MS * 60;

const getTimestamp = (value?: string | Date | null) => {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
};

export function getStudySessionStoredPausedMs(
  session?: Pick<StudySession, 'totalPausedMs' | 'totalPausedTime'> | null,
) {
  return Math.max(0, session?.totalPausedMs ?? (session?.totalPausedTime ?? 0) * MINUTE_MS);
}

export function getStudySessionElapsedMs(session?: StudySession | null, now = Date.now()) {
  const fallbackMs = Math.max(0, (session?.trackedMinutes ?? session?.durationMinutes ?? 0) * MINUTE_MS);
  const startTimestamp = getTimestamp(session?.startTime);

  if (startTimestamp === null) {
    return fallbackMs;
  }

  const status = getStudySessionStatus(session ?? {});
  const endTimestamp = getTimestamp(session?.endTime);
  const pausedTimestamp = getTimestamp(session?.pausedAt);

  let comparisonTimestamp = now;

  if (status === 'completed' && endTimestamp !== null) {
    comparisonTimestamp = endTimestamp;
  } else if (status === 'paused' && pausedTimestamp !== null) {
    comparisonTimestamp = pausedTimestamp;
  } else if (endTimestamp !== null) {
    comparisonTimestamp = endTimestamp;
  }

  if (comparisonTimestamp <= startTimestamp) {
    return fallbackMs;
  }

  return Math.max(0, comparisonTimestamp - startTimestamp - getStudySessionStoredPausedMs(session));
}

export function getStudySessionElapsedSeconds(session?: StudySession | null, now = Date.now()) {
  return Math.floor(getStudySessionElapsedMs(session, now) / SECOND_MS);
}

export function getStudySessionElapsedMinutes(session?: StudySession | null, now = Date.now()) {
  return Math.floor(getStudySessionElapsedMs(session, now) / MINUTE_MS);
}

export function formatStudySessionClock(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [hours, minutes, seconds].map((value) => value.toString().padStart(2, '0')).join(':');
}
