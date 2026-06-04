/**
 * Filter bar above the priority list (design choice 1B).
 *
 * Independent from the sidebar: changing sidebar project does not change
 * this filter. Supports one project at a time (2C); "All projects" is explicit.
 */

import type { ChangeEvent } from 'react';

import { useTaskStore } from '../../store/taskStore';

export function PriorityListFilterBar() {
  const selectedListId = useTaskStore((state) => state.selectedListId);
  const projects = useTaskStore((state) => state.projects);
  const priorityListFilterByWorkspace = useTaskStore((state) => state.priorityListFilterByWorkspace);
  const setPriorityListProjectFilter = useTaskStore((state) => state.setPriorityListProjectFilter);

  if (selectedListId === null) {
    return null;
  }

  const workspaceId = selectedListId;
  const projectsInWorkspace = projects.filter((project) => project.workspace_id === workspaceId);
  const currentFilter = priorityListFilterByWorkspace[workspaceId] ?? null;

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    if (value === '') {
      setPriorityListProjectFilter(workspaceId, null);
      return;
    }
    setPriorityListProjectFilter(workspaceId, Number(value));
  }

  const selectedProject = projectsInWorkspace.find((project) => project.id === currentFilter);

  return (
    <div className="priority-filter">
      <label className="priority-filter__label" htmlFor="priority-project-filter">
        Show tasks from
      </label>
      <select
        id="priority-project-filter"
        className="priority-filter__select"
        value={currentFilter ?? ''}
        onChange={handleChange}
      >
        <option value="">All projects in this workspace</option>
        {projectsInWorkspace.map((project) => (
          <option key={project.id} value={project.id}>
            {project.title}
          </option>
        ))}
      </select>
      {currentFilter !== null && selectedProject && (
        <p className="priority-filter__note">
          Filtered to <strong>{selectedProject.title}</strong>. Dragging reorders only these
          tasks within the workspace list; other projects stay in the same overall positions.
        </p>
      )}
    </div>
  );
}
