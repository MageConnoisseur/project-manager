/**
 * Task API calls used by forms and the priority reorder action.
 */

import type { Task } from '../types';
import { apiClient } from './client';

export interface CreateTaskPayload {
  project_id: number;
  title: string;
  description?: string;
}

export interface TaskReorderItemPayload {
  task_id: number;
  priority_index: number;
}

/** Create a new task under a project */
export async function createTask(payload: CreateTaskPayload): Promise<Task> {
  const { data } = await apiClient.post<Task>('/tasks', payload);
  return data;
}

/** Persist drag-and-drop order from the priority view */
export async function reorderTasks(items: TaskReorderItemPayload[]): Promise<Task[]> {
  const { data } = await apiClient.put<Task[]>('/tasks/reorder', { items });
  return data;
}

/** Load tasks for a workspace (priority list) */
export async function fetchTasksByWorkspace(workspaceId: number): Promise<Task[]> {
  const { data } = await apiClient.get<Task[]>('/tasks', {
    params: { workspace_id: workspaceId },
  });
  return data;
}
