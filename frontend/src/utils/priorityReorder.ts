/**
 * Priority list reorder helpers (Option A).
 *
 * The backend stores one ordered line of tasks per workspace. When the user
 * filters by project, we still save that full line — we only change where
 * the visible (filtered) tasks sit among the slots they already occupied.
 */

import type { Task } from '../types';

/** Sort tasks by priority_index, then id for a stable order */
export function sortTasksByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.priority_index !== b.priority_index) {
      return a.priority_index - b.priority_index;
    }
    return a.id - b.id;
  });
}

/**
 * Tasks visible in the priority list for the current project filter.
 * null projectFilterId = entire workspace.
 */
export function getVisiblePriorityTasks(tasks: Task[], projectFilterId: number | null): Task[] {
  const sorted = sortTasksByPriority(tasks);
  if (projectFilterId === null) {
    return sorted;
  }
  return sorted.filter((task) => task.project_id === projectFilterId);
}

/**
 * After drag-and-drop in a filtered (or unfiltered) view, build the new
 * full workspace task order.
 *
 * Walk the full list in order. Each slot that held a visible task gets the
 * next task from newVisibleOrder; other tasks are unchanged. Then assign
 * priority_index 0..n-1 for the API.
 */
export function mergeVisibleReorderIntoWorkspace(
  fullTasksSorted: Task[],
  visibleTaskIds: Set<number>,
  newVisibleOrder: Task[],
): Task[] {
  const visibleQueue = [...newVisibleOrder];
  const merged = fullTasksSorted.map((task) =>
    visibleTaskIds.has(task.id) ? visibleQueue.shift()! : task,
  );

  return merged.map((task, index) => ({
    ...task,
    priority_index: index,
  }));
}

/** Move one item in a list — used for the visible subset before merging */
export function reorderArray<T>(items: T[], startIndex: number, endIndex: number): T[] {
  const result = [...items];
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}
