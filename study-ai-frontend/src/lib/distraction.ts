import type { DistractionTag } from '@/lib/sessionApi';

export const DISTRACTION_OPTIONS: Array<{
  value: Exclude<DistractionTag, null>;
  label: string;
  emoji: string;
}> = [
  { value: 'phone', label: 'Phone', emoji: '📱' },
  { value: 'social', label: 'Social media', emoji: '🌐' },
  { value: 'sleepy', label: 'Sleepy', emoji: '😴' },
  { value: 'overthinking', label: 'Overthinking', emoji: '🤯' },
  { value: 'other', label: 'Other', emoji: '🌀' },
];

export function formatDistractionTag(tag: DistractionTag | string | undefined) {
  if (!tag) return 'No tag yet';

  const normalized = String(tag);
  const match = DISTRACTION_OPTIONS.find((option) => option.value === normalized);
  if (match) {
    return match.label;
  }

  if (normalized === 'tired') {
    return 'Tired';
  }

  return normalized
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
