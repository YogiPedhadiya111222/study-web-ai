'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import type { CreateTaskInput } from '@/lib/taskApi';

interface TaskCreateFormProps {
  onSubmitTask: (task: CreateTaskInput) => Promise<void>;
  onCancel: () => void;
  initialValues?: Partial<CreateTaskInput>;
  title?: string;
  description?: string;
  submitLabel?: string;
  submittingLabel?: string;
}

const DEFAULT_TASK_FORM: CreateTaskInput = {
  title: '',
  subject: '',
  expectedStudyMinutes: 60,
  difficulty: 3,
};

const buildTaskFormState = (initialValues?: Partial<CreateTaskInput>): CreateTaskInput => ({
  ...DEFAULT_TASK_FORM,
  ...initialValues,
});

function TaskCreateForm({
  onSubmitTask,
  onCancel,
  initialValues,
  title = 'Create Task',
  description = 'Capture the essentials and keep your study queue tight.',
  submitLabel = 'Create Task',
  submittingLabel = 'Saving...',
}: TaskCreateFormProps) {
  const [formState, setFormState] = useState<CreateTaskInput>(() => buildTaskFormState(initialValues));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setFormState(buildTaskFormState(initialValues));
  }, [initialValues]);

  const updateField = useCallback(function updateField<K extends keyof CreateTaskInput>(field: K, value: CreateTaskInput[K]) {
    setFormState((currentState) => {
      if (currentState[field] === value) {
        return currentState;
      }

      return {
        ...currentState,
        [field]: value,
      };
    });
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSubmitting(true);

      try {
        await onSubmitTask(formState);
        setFormState(buildTaskFormState(initialValues));
      } catch {
        // Keep the current form values so the user can retry quickly.
      } finally {
        setSubmitting(false);
      }
    },
    [formState, initialValues, onSubmitTask],
  );

  const handleCancel = useCallback(() => {
    setFormState(buildTaskFormState(initialValues));
    onCancel();
  }, [initialValues, onCancel]);

  return (
    <form onSubmit={handleSubmit} className="surface-card-soft mb-6 rounded-[26px] p-4 sm:p-5">
      <div className="mb-4">
        <p className="text-muted text-sm uppercase tracking-[0.22em]">{title}</p>
        <p className="text-tertiary mt-2 text-sm">{description}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <input
          type="text"
          placeholder="Task title"
          value={formState.title}
          onChange={(event) => updateField('title', event.target.value)}
          className="surface-input rounded-2xl px-4 py-3 outline-none transition-colors"
          required
        />
        <input
          type="text"
          placeholder="Subject"
          value={formState.subject}
          onChange={(event) => updateField('subject', event.target.value)}
          className="surface-input rounded-2xl px-4 py-3 outline-none transition-colors"
          required
        />
        <input
          type="number"
          placeholder="Expected minutes"
          value={formState.expectedStudyMinutes}
          onChange={(event) => {
            const minutes = Number.parseInt(event.target.value, 10);
            updateField('expectedStudyMinutes', Number.isNaN(minutes) ? 0 : minutes);
          }}
          className="surface-input rounded-2xl px-4 py-3 outline-none transition-colors"
          min="1"
        />
        <select
          value={formState.difficulty}
          onChange={(event) => updateField('difficulty', Number.parseInt(event.target.value, 10))}
          className="surface-input rounded-2xl px-4 py-3 outline-none transition-colors"
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
          {submitting ? submittingLabel : submitLabel}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="surface-card-soft text-secondary rounded-2xl px-4 py-3 font-medium transition-all duration-300 hover:border-sky-400/20"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

const MemoizedTaskCreateForm = memo(TaskCreateForm);

MemoizedTaskCreateForm.displayName = 'TaskCreateForm';

export default MemoizedTaskCreateForm;
