/**
 * Left navigation sidebar.
 *
 * Lists workspaces and projects from the store, with inline forms to create
 * each. Sidebar project selection is used when creating tasks (not the
 * priority list filter).
 */

import { CreateProjectForm } from '../projects/CreateProjectForm';
import { CreateWorkspaceForm } from '../workspace/CreateWorkspaceForm';
import { useTaskStore } from '../../store/taskStore';

export function Sidebar() {
  const lists = useTaskStore((state) => state.lists);
  const projects = useTaskStore((state) => state.projects);
  const selectedListId = useTaskStore((state) => state.selectedListId);
  const selectList = useTaskStore((state) => state.selectList);
  const selectProject = useTaskStore((state) => state.selectProject);
  const selectedProjectId = useTaskStore((state) => state.selectedProjectId);

  const projectsForSelectedList = projects.filter(
    (project) => project.workspace_id === selectedListId,
  );

  return (
    <aside className="app-sidebar">
      <div className="app-sidebar__brand">
        <h1 className="app-sidebar__title">Project Manager</h1>
        <p className="app-sidebar__subtitle">Workspaces &amp; projects</p>
      </div>

      <nav className="app-sidebar__nav" aria-label="Workspaces and projects">
        <section className="app-sidebar__section">
          <h2 className="app-sidebar__section-title">Workspaces / Lists</h2>
          {lists.length === 0 ? (
            <p className="app-sidebar__hint">No workspaces yet — add one below.</p>
          ) : (
            <ul className="app-sidebar__list">
              {lists.map((list) => {
                const isSelected = list.id === selectedListId;
                return (
                  <li key={list.id}>
                    <button
                      type="button"
                      className={
                        isSelected
                          ? 'app-sidebar__item app-sidebar__item--active'
                          : 'app-sidebar__item'
                      }
                      onClick={() => selectList(list.id)}
                    >
                      {list.name}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <CreateWorkspaceForm />
        </section>

        <section className="app-sidebar__section">
          <h2 className="app-sidebar__section-title">Projects</h2>
          {selectedListId === null ? (
            <p className="app-sidebar__hint">Select a workspace to see or add projects.</p>
          ) : projectsForSelectedList.length === 0 ? (
            <p className="app-sidebar__hint">No projects yet — add one below.</p>
          ) : (
            <ul className="app-sidebar__list app-sidebar__list--nested">
              {projectsForSelectedList.map((project) => {
                const isSelected = project.id === selectedProjectId;
                return (
                  <li key={project.id}>
                    <button
                      type="button"
                      className={
                        isSelected
                          ? 'app-sidebar__item app-sidebar__item--active'
                          : 'app-sidebar__item'
                      }
                      onClick={() => selectProject(project.id)}
                    >
                      {project.title}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <CreateProjectForm />
        </section>
      </nav>
    </aside>
  );
}
