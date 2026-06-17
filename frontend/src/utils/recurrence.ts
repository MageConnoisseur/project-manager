import type { RecurrenceUnit, Task } from '../types';

const UNIT_LABELS: Record<RecurrenceUnit, { singular: string; plural: string }> = {
  day: { singular: 'day', plural: 'days' },
  week: { singular: 'week', plural: 'weeks' },
  month: { singular: 'month', plural: 'months' },
};

export function formatRecurrenceSummary(task: Task): string | null {
  if (!task.is_recurring || !task.recurrence_interval || !task.recurrence_unit) {
    return null;
  }

  const labels = UNIT_LABELS[task.recurrence_unit];
  const unitLabel = task.recurrence_interval === 1 ? labels.singular : labels.plural;
  const everyLabel = task.recurrence_interval === 1 ? 'Every' : `Every ${task.recurrence_interval}`;

  let summary = `${everyLabel} ${unitLabel}`;
  if (task.due_date) {
    summary += ` · next ${task.due_date}`;
  }
  if (task.recurrence_end_date) {
    summary += ` · ends ${task.recurrence_end_date}`;
  }
  return summary;
}
