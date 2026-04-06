import { fetchJson } from '@/lib/api';
import { normalizeSettings, type AppSettings } from '@/lib/settings';

export interface SettingsResponse extends AppSettings {
  updatedAt?: string | null;
  createdAt?: string | null;
}

export interface SettingsMutationResponse {
  message: string;
  settings: SettingsResponse;
}

export interface ExportedAppData {
  exportedAt: string;
  userId: string;
  settings: SettingsResponse;
  tasks: unknown[];
  sessions: unknown[];
  activities: unknown[];
  tests: unknown[];
}

const normalizeSettingsResponse = (payload: SettingsResponse): SettingsResponse => ({
  ...normalizeSettings(payload),
  updatedAt: payload.updatedAt ?? null,
  createdAt: payload.createdAt ?? null,
});

export async function getSettings() {
  const response = await fetchJson<SettingsResponse>('/settings');
  return normalizeSettingsResponse(response);
}

export async function saveSettings(settings: AppSettings) {
  const response = await fetchJson<SettingsMutationResponse>('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });

  return {
    message: response.message,
    settings: normalizeSettingsResponse(response.settings),
  } satisfies SettingsMutationResponse;
}

export async function resetSettings() {
  const response = await fetchJson<SettingsMutationResponse>('/settings/reset', {
    method: 'POST',
  });

  return {
    message: response.message,
    settings: normalizeSettingsResponse(response.settings),
  } satisfies SettingsMutationResponse;
}

export function exportAppData() {
  return fetchJson<ExportedAppData>('/settings/export');
}

export async function clearAppData() {
  const response = await fetchJson<SettingsMutationResponse>('/settings/data', {
    method: 'DELETE',
  });

  return {
    message: response.message,
    settings: normalizeSettingsResponse(response.settings),
  } satisfies SettingsMutationResponse;
}
