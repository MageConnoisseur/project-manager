import type { Task } from '../types';

/** ISO date string (YYYY-MM-DD) for the user's local calendar day. */
export function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Whether a task should appear in the active priority list.
 *
 * Completed one-off tasks are hidden. Recurring tasks with a future due date
 * are hidden until their next cycle arrives.
 */
export function isTaskActiveInPriorityList(task: Task, today = todayIsoDate()): boolean {
  if (task.is_completed) {
    return false;
  }

  if (task.is_recurring && task.due_date && task.due_date > today) {
    return false;
  }

  return true;
}
