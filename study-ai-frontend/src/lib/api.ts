const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002/api';

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);

  if (init?.body !== undefined && init.body !== null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    let errorMessage = `Request failed: ${response.status}`;

    try {
      const errorData = (await response.json()) as { message?: string };
      if (errorData?.message) {
        errorMessage = errorData.message;
      }
    } catch {
      // Ignore JSON parse errors and fall back to the HTTP status.
    }

    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}

export const taskApi = {
  getAll: () => fetchJson('/tasks'),
  create: (task: Record<string, unknown>) => fetchJson('/tasks', { method: 'POST', body: JSON.stringify(task) }),
  update: (id: string, updates: Record<string, unknown>) =>
    fetchJson(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
  delete: (id: string) => fetchJson(`/tasks/${id}`, { method: 'DELETE' }),
};

export const sessionApi = {
  start: (taskId: string) => fetchJson('/sessions/start', { method: 'POST', body: JSON.stringify({ taskId }) }),
  stop: (sessionId: string) => fetchJson('/sessions/stop', { method: 'POST', body: JSON.stringify({ sessionId }) }),
  pause: (sessionId: string) => fetchJson('/sessions/pause', { method: 'POST', body: JSON.stringify({ sessionId }) }),
  resume: (sessionId: string) => fetchJson('/sessions/resume', { method: 'POST', body: JSON.stringify({ sessionId }) }),
  getActive: () => fetchJson('/sessions/active'),
  getAll: () => fetchJson('/sessions'),
  getById: (id: string) => fetchJson(`/sessions/${id}`),
};
