import type { Task } from '../types';

export type TaskPriorityListStatus = 'active' | 'completed' | 'scheduled';

export type PriorityListStatusFilter = TaskPriorityListStatus | 'all';

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

  if (isRecurringTaskScheduledForFuture(task, today)) {
    return false;
  }

  return true;
}

/** Recurring task waiting for its next due date (not the same as completed one-offs). */
export function isRecurringTaskScheduledForFuture(task: Task, today = todayIsoDate()): boolean {
  return Boolean(
    task.is_recurring && !task.is_completed && task.due_date && task.due_date > today,
  );
}

/** Whether a one-off (or finished recurring) task belongs in the completed history view. */
export function isTaskCompletedInPriorityList(task: Task): boolean {
  return task.is_completed;
}

/** Which priority-list bucket a task belongs to (mutually exclusive). */
export function getTaskPriorityListStatus(
  task: Task,
  today = todayIsoDate(),
): TaskPriorityListStatus {
  if (isTaskCompletedInPriorityList(task)) {
    return 'completed';
  }

  if (isRecurringTaskScheduledForFuture(task, today)) {
    return 'scheduled';
  }

  return 'active';
}

/** Apply the priority list status filter (active, completed, scheduled, or all). */
export function isTaskVisibleByStatusFilter(
  task: Task,
  statusFilter: PriorityListStatusFilter,
  today = todayIsoDate(),
): boolean {
  if (statusFilter === 'all') {
    return true;
  }

  if (statusFilter === 'completed') {
    return isTaskCompletedInPriorityList(task);
  }

  if (statusFilter === 'scheduled') {
    return isRecurringTaskScheduledForFuture(task, today);
  }

  return isTaskActiveInPriorityList(task, today);
}
