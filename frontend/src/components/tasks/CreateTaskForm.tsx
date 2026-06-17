/**
 * Form to create a new task under the selected project.
 *
 * Requires a project to be selected in the sidebar. Errors from POST /tasks
 * are shown inline — never swallowed in a silent catch.
 */

import { useState } from 'react';
import type { FormEvent } from 'react';

import { getAxiosErrorMessage } from '../../api/errors';
import { useTaskStore } from '../../store/taskStore';
import {
  RecurrenceFields,
  defaultRecurrenceFormValues,
  recurrencePayloadFromForm,
  type RecurrenceFormValues,
} from './RecurrenceFields';

export function CreateTaskForm() {
  const selectedProjectId = useTaskStore((state) => state.selectedProjectId);
  const projects = useTaskStore((state) => state.projects);
  const createTask = useTaskStore((state) => state.createTask);
  const fetchTasks = useTaskStore((state) => state.fetchTasks);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceFormValues>(defaultRecurrenceFormValues());
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedProject = projects.find((project) => project.id === selectedProjectId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (selectedProjectId === null) {
      setError('Select a project in the sidebar before creating a task.');
      return;
    }

    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const created = await createTask({
        project_id: selectedProjectId,
        title: title.trim(),
        description: description.trim(),
        ...recurrencePayloadFromForm(recurrence),
      });

      if (!created) {
        const storeError = useTaskStore.getState().error;
        setError(storeError ?? 'Failed to create task.');
        return;
      }

      setTitle('');
      setDescription('');
      setRecurrence(defaultRecurrenceFormValues());
      await fetchTasks();
    } catch (submitError) {
      setError(getAxiosErrorMessage(submitError, 'Failed to create task.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <h3>Create task</h3>
      {selectedProject ? (
        <p className="task-form__context">Project: {selectedProject.title}</p>
      ) : (
        <p className="task-form__context">Select a project in the sidebar first.</p>
      )}

      <label className="task-form__field">
        <span>Title</span>
        <input
          type="text"
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={selectedProjectId === null}
          required
        />
      </label>

      <label className="task-form__field">
        <span>Notes (optional)</span>
        <textarea
          name="description"
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={selectedProjectId === null}
        />
      </label>

      <RecurrenceFields
        values={recurrence}
        onChange={setRecurrence}
        disabled={selectedProjectId === null || isSubmitting}
      />

      {error && <p className="text-red-500">{error}</p>}

      <button
        type="submit"
        className="btn btn--primary"
        disabled={isSubmitting || selectedProjectId === null}
      >
        {isSubmitting ? 'Saving…' : 'Add task'}
      </button>
    </form>
  );
}
