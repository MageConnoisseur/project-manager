/**
 * Inline panel for editing an existing task, including recurrence controls.
 */

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { getAxiosErrorMessage } from '../../api/errors';
import type { UpdateTaskPayload } from '../../api/tasks';
import { useTaskStore } from '../../store/taskStore';
import type { Task } from '../../types';
import {
  RecurrenceFields,
  defaultRecurrenceFormValues,
  recurrenceFormValuesFromTask,
  recurrencePayloadFromForm,
  type RecurrenceFormValues,
} from './RecurrenceFields';

interface TaskEditPanelProps {
  task: Task;
  onClose: () => void;
}

export function TaskEditPanel({ task, onClose }: TaskEditPanelProps) {
  const updateTask = useTaskStore((state) => state.updateTask);

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [recurrence, setRecurrence] = useState<RecurrenceFormValues>(
    recurrenceFormValuesFromTask(task),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? '');
    setRecurrence(recurrenceFormValuesFromTask(task));
  }, [task.id, task.updated_at]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }

    setIsSubmitting(true);

    const payload: UpdateTaskPayload = {
      title: title.trim(),
      description: description.trim(),
      ...recurrencePayloadFromForm(recurrence),
    };

    try {
      const updated = await updateTask(task.id, payload);
      if (!updated) {
        const storeError = useTaskStore.getState().error;
        setError(storeError ?? 'Failed to update task.');
        return;
      }
      onClose();
    } catch (submitError) {
      setError(getAxiosErrorMessage(submitError, 'Failed to update task.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStopRecurrence() {
    setError(null);
    setIsSubmitting(true);

    try {
      const updated = await updateTask(task.id, {
        is_recurring: false,
        recurrence_interval: null,
        recurrence_unit: null,
        recurrence_end_date: null,
      });

      if (!updated) {
        const storeError = useTaskStore.getState().error;
        setError(storeError ?? 'Failed to stop recurrence.');
        return;
      }

      setRecurrence(defaultRecurrenceFormValues());
      onClose();
    } catch (submitError) {
      setError(getAxiosErrorMessage(submitError, 'Failed to stop recurrence.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="task-edit-panel" onSubmit={handleSubmit}>
      <label className="task-form__field">
        <span>Title</span>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
      </label>

      <label className="task-form__field">
        <span>Notes</span>
        <textarea
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>

      <RecurrenceFields
        idPrefix={`task-${task.id}`}
        values={recurrence}
        onChange={setRecurrence}
        disabled={isSubmitting}
      />

      {error && <p className="text-red-500">{error}</p>}

      <div className="task-edit-panel__actions">
        <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" className="btn" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </button>
        {task.is_recurring && (
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => void handleStopRecurrence()}
            disabled={isSubmitting}
          >
            Stop recurrence
          </button>
        )}
      </div>
    </form>
  );
}
