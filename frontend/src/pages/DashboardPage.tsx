/**
 * Main dashboard after login.
 *
 * Loads lists and projects from the API, then shows the priority list,
 * create-task form, and welcome copy.
 */

import { useEffect } from 'react';

import { CreateTaskForm } from '../components/tasks/CreateTaskForm';
import { PriorityListView } from '../components/tasks/PriorityListView';
import { useTaskStore } from '../store/taskStore';

export function DashboardPage() {
  const fetchLists = useTaskStore((state) => state.fetchLists);
  const fetchProjects = useTaskStore((state) => state.fetchProjects);
  const selectedListId = useTaskStore((state) => state.selectedListId);

  useEffect(() => {
    void fetchLists();
  }, [fetchLists]);

  useEffect(() => {
    if (selectedListId !== null) {
      void fetchProjects(selectedListId);
    }
  }, [selectedListId, fetchProjects]);

  return (
    <div className="dashboard">
      <section className="welcome-panel">
        <h2>Dashboard</h2>
        <p>
          Add workspaces and projects in the sidebar, then select a project there to create tasks.
          Use the priority list filter to focus the main view. Reorder saves roll back on failure.
        </p>
      </section>

      <PriorityListView />
      <CreateTaskForm />
    </div>
  );
}
