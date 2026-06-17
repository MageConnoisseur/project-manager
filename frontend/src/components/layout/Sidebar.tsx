/**
 * Left navigation sidebar.
 *
 * Lists workspaces and projects from the store, with inline forms to create
 * each. Sidebar project selection is used when creating tasks (not the
 * priority list filter). Delete buttons remove items after confirmation.
 */

import { useState } from 'react';

import { ConfirmDialog } from '../common/ConfirmDialog';
import { CreateProjectForm } from '../projects/CreateProjectForm';
import { CreateWorkspaceForm } from '../workspace/CreateWorkspaceForm';
import { useTaskStore } from '../../store/taskStore';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

type PendingDelete =
  | { type: 'list'; id: number; name: string }
  | { type: 'project'; id: number; name: string }
  | null;

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const lists = useTaskStore((state) => state.lists);
  const projects = useTaskStore((state) => state.projects);
  const selectedListId = useTaskStore((state) => state.selectedListId);
  const selectList = useTaskStore((state) => state.selectList);
  const selectProject = useTaskStore((state) => state.selectProject);
  const selectedProjectId = useTaskStore((state) => state.selectedProjectId);
  const deleteList = useTaskStore((state) => state.deleteList);
  const deleteProject = useTaskStore((state) => state.deleteProject);
  const isLoading = useTaskStore((state) => state.isLoading);

  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);

  const projectsForSelectedList = projects.filter(
    (project) => project.workspace_id === selectedListId,
  );

  function handleSelectList(listId: number) {
    selectList(listId);
    onClose();
  }

  function handleSelectProject(projectId: number) {
    selectProject(projectId);
    onClose();
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) {
      return;
    }

    const success =
      pendingDelete.type === 'list'
        ? await deleteList(pendingDelete.id)
        : await deleteProject(pendingDelete.id);

    if (success) {
      setPendingDelete(null);
    }
  }

  const deleteDialogTitle =
    pendingDelete?.type === 'list' ? 'Delete workspace?' : 'Delete project?';

  const deleteDialogMessage =
    pendingDelete?.type === 'list'
      ? `Delete "${pendingDelete.name}" and all projects and tasks inside it? This cannot be undone.`
      : pendingDelete
        ? `Delete "${pendingDelete.name}" and all tasks inside it? This cannot be undone.`
        : '';

  return (
    <>
      <aside
        id="app-sidebar"
        className={isOpen ? 'app-sidebar app-sidebar--open' : 'app-sidebar'}
      >
        <div className="app-sidebar__brand">
          <div className="app-sidebar__brand-text">
            <h1 className="app-sidebar__title">Project Manager</h1>
            <p className="app-sidebar__subtitle">Workspaces &amp; projects</p>
          </div>
          <button
            type="button"
            className="app-sidebar__close"
            onClick={onClose}
            aria-label="Close navigation menu"
          >
            ×
          </button>
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
                    <li key={list.id} className="app-sidebar__row">
                      <button
                        type="button"
                        className={
                          isSelected
                            ? 'app-sidebar__item app-sidebar__item--active'
                            : 'app-sidebar__item'
                        }
                        onClick={() => handleSelectList(list.id)}
                      >
                        {list.name}
                      </button>
                      <button
                        type="button"
                        className="app-sidebar__delete"
                        aria-label={`Delete workspace ${list.name}`}
                        title={`Delete ${list.name}`}
                        onClick={() =>
                          setPendingDelete({ type: 'list', id: list.id, name: list.name })
                        }
                      >
                        ×
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
                    <li key={project.id} className="app-sidebar__row">
                      <button
                        type="button"
                        className={
                          isSelected
                            ? 'app-sidebar__item app-sidebar__item--active'
                            : 'app-sidebar__item'
                        }
                        onClick={() => handleSelectProject(project.id)}
                      >
                        {project.title}
                      </button>
                      <button
                        type="button"
                        className="app-sidebar__delete"
                        aria-label={`Delete project ${project.title}`}
                        title={`Delete ${project.title}`}
                        onClick={() =>
                          setPendingDelete({
                            type: 'project',
                            id: project.id,
                            name: project.title,
                          })
                        }
                      >
                        ×
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

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title={deleteDialogTitle}
        message={deleteDialogMessage}
        isLoading={isLoading}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
