/**
 * Compact form to create a new workspace / list (POST /lists).
 *
 * Lives in the sidebar so users can add top-level categories without leaving
 * the main layout. Errors are shown inline next to the form.
 */

import { useState } from 'react';
import type { FormEvent } from 'react';

import { getAxiosErrorMessage } from '../../api/errors';
import { useTaskStore } from '../../store/taskStore';

export function CreateWorkspaceForm() {
  const createList = useTaskStore((state) => state.createList);

  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Workspace name is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createList(name);
      if (!created) {
        setError(useTaskStore.getState().error ?? 'Failed to create workspace.');
        return;
      }
      setName('');
    } catch (submitError) {
      setError(getAxiosErrorMessage(submitError, 'Failed to create workspace.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="sidebar-form" onSubmit={handleSubmit}>
      <label className="sidebar-form__field">
        <span className="sidebar-form__label">New workspace name</span>
        <input
          type="text"
          name="workspaceName"
          placeholder="e.g. Work Projects"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={255}
        />
      </label>
      {error && <p className="text-red-500">{error}</p>}
      <button type="submit" className="btn btn--primary btn--block" disabled={isSubmitting}>
        {isSubmitting ? 'Adding…' : 'Add workspace'}
      </button>
    </form>
  );
}
