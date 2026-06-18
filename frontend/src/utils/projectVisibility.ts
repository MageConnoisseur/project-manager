import type { Project } from '../types';

/** Whether a project is active (shown in the sidebar and priority filters). */
export function isActiveProject(project: Project): boolean {
  return !project.is_completed;
}

export function getActiveProjectsInWorkspace(
  projects: Project[],
  workspaceId: number,
): Project[] {
  return projects.filter(
    (project) => project.workspace_id === workspaceId && isActiveProject(project),
  );
}

export function getCompletedProjectsInWorkspace(
  projects: Project[],
  workspaceId: number,
): Project[] {
  return projects.filter(
    (project) => project.workspace_id === workspaceId && project.is_completed,
  );
}

/** Set of project ids that are completed/archived. */
export function getCompletedProjectIds(projects: Project[]): Set<number> {
  return new Set(projects.filter((project) => project.is_completed).map((project) => project.id));
}
