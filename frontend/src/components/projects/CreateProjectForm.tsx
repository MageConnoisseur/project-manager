/**
 * Compact form to create a project in the selected workspace (POST /projects).
 *
 * Requires a workspace to be selected in the sidebar first.
 */

import { useState } from 'react';
import type { FormEvent } from 'react';

import { getAxiosErrorMessage } from '../../api/errors';
import { useTaskStore } from '../../store/taskStore';

export function CreateProjectForm() {
  const selectedListId = useTaskStore((state) => state.selectedListId);
  const lists = useTaskStore((state) => state.lists);
  const createProject = useTaskStore((state) => state.createProject);

  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedWorkspace = lists.find((list) => list.id === selectedListId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (selectedListId === null) {
      setError('Select or create a workspace first.');
      return;
    }

    if (!title.trim()) {
      setError('Project title is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createProject(selectedListId, title);
      if (!created) {
        setError(useTaskStore.getState().error ?? 'Failed to create project.');
        return;
      }
      setTitle('');
    } catch (submitError) {
      setError(getAxiosErrorMessage(submitError, 'Failed to create project.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="sidebar-form" onSubmit={handleSubmit}>
      {selectedWorkspace ? (
        <p className="sidebar-form__context">In: {selectedWorkspace.name}</p>
      ) : (
        <p className="sidebar-form__context">Select a workspace above first.</p>
      )}

      <label className="sidebar-form__field">
        <span className="sidebar-form__label">New project title</span>
        <input
          type="text"
          name="projectTitle"
          placeholder="e.g. Q2 Launch"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={selectedListId === null}
          maxLength={255}
        />
      </label>
      {error && <p className="text-red-500">{error}</p>}
      <button
        type="submit"
        className="btn btn--primary btn--block"
        disabled={isSubmitting || selectedListId === null}
      >
        {isSubmitting ? 'Adding…' : 'Add project'}
      </button>
    </form>
  );
}
