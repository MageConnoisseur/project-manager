import type { RecurrenceUnit, Task } from '../types';
import { todayIsoDate } from './taskVisibility';

const UNIT_LABELS: Record<RecurrenceUnit, { singular: string; plural: string }> = {
  day: { singular: 'day', plural: 'days' },
  week: { singular: 'week', plural: 'weeks' },
  month: { singular: 'month', plural: 'months' },
};

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

export function formatRecurrenceCadence(interval: number, unit: RecurrenceUnit): string {
  const labels = UNIT_LABELS[unit];
  const unitLabel = interval === 1 ? labels.singular : labels.plural;
  return interval === 1 ? `every ${unitLabel}` : `every ${interval} ${unitLabel}`;
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

function formatIsoDate({ year, month, day }: CalendarDate): string {
  return `${year}-${padDatePart(month)}-${padDatePart(day)}`;
}

function parseIsoDate(isoDate: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

/** Advance a calendar date the same way the API does, without timezone shifts. */
export function addRecurrenceInterval(
  baseIso: string,
  interval: number,
  unit: RecurrenceUnit,
): string {
  const base = parseIsoDate(baseIso);
  if (!base) {
    return baseIso;
  }

  if (unit === 'day' || unit === 'week') {
    const days = unit === 'week' ? interval * 7 : interval;
    const next = new Date(base.year, base.month - 1, base.day + days);
    return formatIsoDate({
      year: next.getFullYear(),
      month: next.getMonth() + 1,
      day: next.getDate(),
    });
  }

  const monthIndex = base.month - 1 + interval;
  const year = base.year + Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;
  const lastDay = new Date(year, month, 0).getDate();
  return formatIsoDate({ year, month, day: Math.min(base.day, lastDay) });
}

/** Suggested next due date: one interval after the current due date, or today if unset. */
export function suggestNextDueDate(
  task: {
    is_recurring?: boolean;
    recurrence_interval: number | null;
    recurrence_unit: RecurrenceUnit | null;
    due_date: string | null;
  },
  today = todayIsoDate(),
): string | null {
  if (task.is_recurring === false || !task.recurrence_interval || !task.recurrence_unit) {
    return null;
  }

  return addRecurrenceInterval(
    task.due_date || today,
    task.recurrence_interval,
    task.recurrence_unit,
  );
}

export function formatIsoDateForDisplay(isoDate: string): string {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) {
    return isoDate;
  }

  return new Date(parsed.year, parsed.month - 1, parsed.day).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

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
