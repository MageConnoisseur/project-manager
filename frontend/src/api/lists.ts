/**
 * Workspace / list API calls.
 */

import type { Project, WorkspaceList } from '../types';
import { apiClient } from './client';

export async function fetchLists(): Promise<WorkspaceList[]> {
  const { data } = await apiClient.get<WorkspaceList[]>('/lists');
  return data;
}

export async function fetchProjects(workspaceId?: number): Promise<Project[]> {
  const { data } = await apiClient.get<Project[]>('/projects', {
    params: workspaceId ? { workspace_id: workspaceId } : undefined,
  });
  return data;
}

/** Create a new workspace / list (POST /lists) */
export async function createList(name: string): Promise<WorkspaceList> {
  const { data } = await apiClient.post<WorkspaceList>('/lists', { name });
  return data;
}

/** Create a new project inside a workspace (POST /projects) */
export async function createProject(
  workspaceId: number,
  title: string,
  description = '',
): Promise<Project> {
  const { data } = await apiClient.post<Project>('/projects', {
    workspace_id: workspaceId,
    title,
    description,
  });
  return data;
}

/** Delete a workspace / list and all projects and tasks inside it */
export async function deleteList(listId: number): Promise<void> {
  await apiClient.delete(`/lists/${listId}`);
}

/** Delete a project and all tasks inside it */
export async function deleteProject(projectId: number): Promise<void> {
  await apiClient.delete(`/projects/${projectId}`);
}

/** Mark a project complete or restore it to active */
export async function updateProject(
  projectId: number,
  payload: { is_completed?: boolean },
): Promise<Project> {
  const { data } = await apiClient.put<Project>(`/projects/${projectId}`, payload);
  return data;
}
