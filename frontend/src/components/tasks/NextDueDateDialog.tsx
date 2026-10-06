/**
 * Asks for the next due date when a recurring task is checked off.
 *
 * The date field opens the browser calendar. It starts on the usual next
 * date (one interval after the current due date) so a fixed schedule is one
 * click, and a late chore can be pushed out instead.
 */

import { useEffect, useId, useRef, useState } from 'react';

import type { RecurrenceUnit } from '../../types';
import {
  formatIsoDateForDisplay,
  formatRecurrenceCadence,
  suggestNextDueDate,
} from '../../utils/recurrence';
import { todayIsoDate } from '../../utils/taskVisibility';

export interface NextDueDateTask {
  id: number;
  title: string;
  due_date: string | null;
  recurrence_interval: number;
  recurrence_unit: RecurrenceUnit;
  recurrence_end_date: string | null;
}

interface NextDueDateDialogProps {
  task: NextDueDateTask;
  isLoading?: boolean;
  error?: string | null;
  onConfirm: (nextDueDate: string) => void;
  onCancel: () => void;
}

export function NextDueDateDialog({
  task,
  isLoading = false,
  error = null,
  onConfirm,
  onCancel,
}: NextDueDateDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dateInputRef = useRef<HTMLInputElement>(null);
  const suggestedDate = suggestNextDueDate(task) ?? todayIsoDate();
  const [selectedDate, setSelectedDate] = useState(suggestedDate);
  const today = todayIsoDate();
  const endsSeries = Boolean(task.recurrence_end_date && selectedDate > task.recurrence_end_date);

  useEffect(() => {
    const input = dateInputRef.current;
    if (!input) {
      return;
    }

    input.focus();
    try {
      const opened = input.showPicker() as void | Promise<void>;
      if (opened && typeof opened.catch === 'function') {
        void opened.catch(() => undefined);
      }
    } catch {
      // Browsers only open the calendar from a user gesture. The field stays focused.
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isLoading) {
        onCancel();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isLoading, onCancel]);

  const dueDateLabel = task.due_date ? formatIsoDateForDisplay(task.due_date) : null;
  const suggestedLabel = formatIsoDateForDisplay(suggestedDate);
  const cadence = formatRecurrenceCadence(task.recurrence_interval, task.recurrence_unit);

  let consequence = 'That date is today or earlier, so it will stay on the active list.';
  if (endsSeries && task.recurrence_end_date) {
    consequence = `That is after this task stops repeating on ${formatIsoDateForDisplay(task.recurrence_end_date)}, so it will stay completed.`;
  } else if (selectedDate > today) {
    consequence = 'It will leave the active list and come back on this date.';
  }

  return (
    <div
      className="confirm-dialog-backdrop"
      role="presentation"
      onClick={() => {
        if (!isLoading) {
          onCancel();
        }
      }}
    >
      <div
        className="confirm-dialog next-due-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id={titleId} className="confirm-dialog__title">
          When should this happen next?
        </h3>
        <p id={descriptionId} className="confirm-dialog__message">
          “{task.title}” repeats {cadence}.
          {dueDateLabel ? ` It was due ${dueDateLabel}.` : ''} The usual next date is{' '}
          {suggestedLabel}. Pick the day you want it to come back.
        </p>

        <label className="task-form__field" htmlFor={`${titleId}-date`}>
          <span>Next date</span>
          <input
            ref={dateInputRef}
            id={`${titleId}-date`}
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            disabled={isLoading}
            required
          />
        </label>

        {selectedDate !== suggestedDate && (
          <button
            type="button"
            className="next-due-dialog__suggestion"
            onClick={() => setSelectedDate(suggestedDate)}
            disabled={isLoading}
          >
            Use suggested date ({suggestedLabel})
          </button>
        )}

        {selectedDate && <p className="next-due-dialog__consequence">{consequence}</p>}
        {error && <p className="text-red-500">{error}</p>}

        <div className="confirm-dialog__actions next-due-dialog__actions">
          <button type="button" className="btn" onClick={onCancel} disabled={isLoading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => onConfirm(selectedDate)}
            disabled={isLoading || selectedDate.trim() === ''}
          >
            {isLoading ? 'Saving…' : endsSeries ? 'Stop repeating' : 'Schedule next'}
          </button>
        </div>
      </div>
    </div>
  );
}
