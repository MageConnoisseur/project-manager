/**
 * Task-related global state (Zustand).
 *
 * Stores workspaces (lists), projects, and tasks for the logged-in user.
 * reorderTasks applies an optimistic UI update, keeps a backup of the
 * previous order, and rolls back if PUT /tasks/reorder fails.
 */

import { create } from 'zustand';

import { getAxiosErrorMessage } from '../api/errors';
import {
  createList as createListApi,
  createProject as createProjectApi,
  fetchLists,
  fetchProjects,
} from '../api/lists';
import { createTask as createTaskApi, fetchTasksByWorkspace, reorderTasks as reorderTasksApi } from '../api/tasks';
import type { CreateTaskPayload } from '../api/tasks';
import type { Project, Task, WorkspaceList } from '../types';
import {
  loadPriorityListFilters,
  savePriorityListFilters,
  type PriorityListFilterMap,
} from '../utils/priorityListFilterStorage';
import { sortTasksByPriority } from '../utils/priorityReorder';

/** Read-only slice of state exposed to components */
interface TaskState {
  lists: WorkspaceList[];
  projects: Project[];
  tasks: Task[];
  selectedListId: number | null;
  selectedProjectId: number | null;
  /**
   * Priority list project filter per workspace (null = all projects).
   * Persisted to localStorage; separate from sidebar selectedProjectId (5A).
   */
  priorityListFilterByWorkspace: PriorityListFilterMap;
  isLoading: boolean;
  /** Field-level / store-level errors (forms may use their own local error too) */
  error: string | null;
}

interface TaskActions {
  selectList: (listId: number) => void;
  selectProject: (projectId: number) => void;
  clearSelection: () => void;
  clearError: () => void;
  /** Set priority list filter for one workspace; saved to localStorage (4B) */
  setPriorityListProjectFilter: (workspaceId: number, projectId: number | null) => void;

  fetchLists: () => Promise<void>;
  fetchProjects: (workspaceId?: number) => Promise<void>;
  fetchTasks: (workspaceId?: number) => Promise<void>;
  createList: (name: string) => Promise<WorkspaceList | null>;
  createProject: (workspaceId: number, title: string, description?: string) => Promise<Project | null>;
  createTask: (payload: CreateTaskPayload) => Promise<Task | null>;

  /**
   * Optimistic reorder for drag-and-drop on the full workspace task list.
   * Pass the merged full list (after Option A merge when filtered).
   */
  reorderTasks: (mergedFullWorkspaceTasks: Task[]) => Promise<boolean>;
}

export type TaskStore = TaskState & TaskActions;

export const useTaskStore = create<TaskStore>((set, get) => ({
  lists: [],
  projects: [],
  tasks: [],
  selectedListId: null,
  selectedProjectId: null,
  priorityListFilterByWorkspace: loadPriorityListFilters(),
  isLoading: false,
  error: null,

  selectList: (listId) => {
    set({ selectedListId: listId, selectedProjectId: null });
  },

  selectProject: (projectId) => {
    set({ selectedProjectId: projectId });
  },

  clearSelection: () => {
    set({ selectedListId: null, selectedProjectId: null });
  },

  clearError: () => {
    set({ error: null });
  },

  setPriorityListProjectFilter: (workspaceId, projectId) => {
    const next = { ...get().priorityListFilterByWorkspace, [workspaceId]: projectId };
    set({ priorityListFilterByWorkspace: next });
    savePriorityListFilters(next);
  },

  fetchLists: async () => {
    set({ isLoading: true, error: null });
    try {
      const lists = await fetchLists();
      set({
        lists,
        selectedListId: get().selectedListId ?? lists[0]?.id ?? null,
      });
    } catch (error) {
      set({ error: getAxiosErrorMessage(error, 'Failed to load workspaces.') });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchProjects: async (workspaceId) => {
    set({ isLoading: true, error: null });
    try {
      const listId = workspaceId ?? get().selectedListId ?? undefined;
      const projects = await fetchProjects(listId);
      set({ projects });

      if (listId !== undefined) {
        const savedFilter = get().priorityListFilterByWorkspace[listId];
        if (
          savedFilter !== null &&
          savedFilter !== undefined &&
          !projects.some((project) => project.id === savedFilter)
        ) {
          get().setPriorityListProjectFilter(listId, null);
        }
      }
    } catch (error) {
      set({ error: getAxiosErrorMessage(error, 'Failed to load projects.') });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchTasks: async (workspaceId) => {
    const listId = workspaceId ?? get().selectedListId;
    if (listId === null) {
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const tasks = await fetchTasksByWorkspace(listId);
      set({ tasks: sortTasksByPriority(tasks) });
    } catch (error) {
      set({ error: getAxiosErrorMessage(error, 'Failed to load tasks.') });
    } finally {
      set({ isLoading: false });
    }
  },

  createList: async (name) => {
    const trimmed = name.trim();
    if (!trimmed) {
      return null;
    }

    set({ isLoading: true, error: null });
    try {
      const created = await createListApi(trimmed);
      set((state) => ({
        lists: [...state.lists, created],
        selectedListId: created.id,
        selectedProjectId: null,
      }));
      await get().fetchProjects(created.id);
      return created;
    } catch (error) {
      set({ error: getAxiosErrorMessage(error, 'Failed to create workspace.') });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  createProject: async (workspaceId, title, description = '') => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      return null;
    }

    set({ isLoading: true, error: null });
    try {
      const created = await createProjectApi(workspaceId, trimmedTitle, description.trim());
      set((state) => ({
        projects: [...state.projects, created],
        selectedListId: workspaceId,
        selectedProjectId: created.id,
      }));
      return created;
    } catch (error) {
      set({ error: getAxiosErrorMessage(error, 'Failed to create project.') });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  createTask: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const created = await createTaskApi(payload);
      set((state) => ({
        tasks: sortTasksByPriority([...state.tasks, created]),
      }));
      return created;
    } catch (error) {
      set({ error: getAxiosErrorMessage(error, 'Failed to create task.') });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  reorderTasks: async (mergedFullWorkspaceTasks) => {
    const previousTasks = [...get().tasks];
    const sortedMerged = sortTasksByPriority(mergedFullWorkspaceTasks);

    set({ tasks: sortedMerged, error: null });

    const items = sortedMerged.map((task, index) => ({
      task_id: task.id,
      priority_index: index,
    }));

    try {
      const saved = await reorderTasksApi(items);
      set({ tasks: sortTasksByPriority(saved) });
      return true;
    } catch (error) {
      console.error('[taskStore] reorderTasks failed — rolling back to previous order', error);
      set({
        tasks: previousTasks,
        error: getAxiosErrorMessage(error, 'Failed to save task order. Your list was restored.'),
      });
      return false;
    }
  },
}));
