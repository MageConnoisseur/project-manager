/**
 * Task API calls used by forms and the priority reorder action.
 */

import type { RecurrenceUnit, Task } from '../types';
import { apiClient } from './client';

export interface CreateTaskPayload {
  project_id: number;
  title: string;
  description?: string;
  due_date?: string | null;
  is_recurring?: boolean;
  recurrence_interval?: number | null;
  recurrence_unit?: RecurrenceUnit | null;
  recurrence_end_date?: string | null;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  due_date?: string | null;
  is_completed?: boolean;
  is_recurring?: boolean;
  recurrence_interval?: number | null;
  recurrence_unit?: RecurrenceUnit | null;
  recurrence_end_date?: string | null;
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

/** Update an existing task */
export async function updateTask(taskId: number, payload: UpdateTaskPayload): Promise<Task> {
  const { data } = await apiClient.put<Task>(`/tasks/${taskId}`, payload);
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

/** Delete a task */
export async function deleteTask(taskId: number): Promise<void> {
  await apiClient.delete(`/tasks/${taskId}`);
}
