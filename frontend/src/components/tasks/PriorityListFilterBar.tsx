/**
 * Filter bar above the priority list (design choice 1B).
 *
 * Independent from the sidebar: changing sidebar project does not change
 * this filter. Supports one project at a time (2C); "All projects" is explicit.
 */

import type { ChangeEvent } from 'react';

import { useTaskStore } from '../../store/taskStore';
import type { PriorityListStatusFilter } from '../../utils/taskVisibility';

export function PriorityListFilterBar() {
  const selectedListId = useTaskStore((state) => state.selectedListId);
  const projects = useTaskStore((state) => state.projects);
  const priorityListFilterByWorkspace = useTaskStore((state) => state.priorityListFilterByWorkspace);
  const priorityListStatusFilterByWorkspace = useTaskStore(
    (state) => state.priorityListStatusFilterByWorkspace,
  );
  const setPriorityListProjectFilter = useTaskStore((state) => state.setPriorityListProjectFilter);
  const setPriorityListStatusFilter = useTaskStore((state) => state.setPriorityListStatusFilter);

  if (selectedListId === null) {
    return null;
  }

  const workspaceId = selectedListId;
  const projectsInWorkspace = projects.filter((project) => project.workspace_id === workspaceId);
  const currentFilter = priorityListFilterByWorkspace[workspaceId] ?? null;
  const currentStatusFilter = priorityListStatusFilterByWorkspace[workspaceId] ?? 'active';

  function handleProjectChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    if (value === '') {
      setPriorityListProjectFilter(workspaceId, null);
      return;
    }
    setPriorityListProjectFilter(workspaceId, Number(value));
  }

  function handleStatusChange(event: ChangeEvent<HTMLSelectElement>) {
    setPriorityListStatusFilter(workspaceId, event.target.value as PriorityListStatusFilter);
  }

  const selectedProject = projectsInWorkspace.find((project) => project.id === currentFilter);

  return (
    <div className="priority-filter">
      <div className="priority-filter__row">
        <div className="priority-filter__field">
          <label className="priority-filter__label" htmlFor="priority-status-filter">
            Task status
          </label>
          <select
            id="priority-status-filter"
            className="priority-filter__select"
            value={currentStatusFilter}
            onChange={handleStatusChange}
          >
            <option value="active">Active tasks</option>
            <option value="completed">Completed tasks</option>
          </select>
        </div>

        <div className="priority-filter__field">
          <label className="priority-filter__label" htmlFor="priority-project-filter">
            Show tasks from
          </label>
          <select
            id="priority-project-filter"
            className="priority-filter__select"
            value={currentFilter ?? ''}
            onChange={handleProjectChange}
          >
            <option value="">All projects in this workspace</option>
            {projectsInWorkspace.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {currentStatusFilter === 'completed' && (
        <p className="priority-filter__note">
          Showing completed one-off tasks and recurring tasks that have finished their schedule.
          Uncheck a task to move it back to the active list.
        </p>
      )}

      {currentStatusFilter === 'active' && currentFilter !== null && selectedProject && (
        <p className="priority-filter__note">
          Filtered to <strong>{selectedProject.title}</strong>. Dragging reorders only these
          tasks within the workspace list; other projects stay in the same overall positions.
        </p>
      )}
    </div>
  );
}
