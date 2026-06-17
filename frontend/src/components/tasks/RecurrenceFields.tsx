/**
 * Shared recurrence controls for create and edit task forms.
 */

import type { RecurrenceUnit } from '../../types';

export interface RecurrenceFormValues {
  isRecurring: boolean;
  recurrenceInterval: number;
  recurrenceUnit: RecurrenceUnit;
  dueDate: string;
  recurrenceEndDate: string;
}

interface RecurrenceFieldsProps {
  values: RecurrenceFormValues;
  onChange: (values: RecurrenceFormValues) => void;
  disabled?: boolean;
  idPrefix?: string;
}

export function RecurrenceFields({
  values,
  onChange,
  disabled = false,
  idPrefix = 'recurrence',
}: RecurrenceFieldsProps) {
  function update<K extends keyof RecurrenceFormValues>(key: K, value: RecurrenceFormValues[K]) {
    onChange({ ...values, [key]: value });
  }

  return (
    <fieldset className="recurrence-fields" disabled={disabled}>
      <label className="task-form__field task-form__field--checkbox">
        <input
          id={`${idPrefix}-enabled`}
          type="checkbox"
          checked={values.isRecurring}
          onChange={(event) => update('isRecurring', event.target.checked)}
        />
        <span>Recurring task</span>
      </label>

      {values.isRecurring && (
        <div className="recurrence-fields__details">
          <div className="recurrence-fields__row">
            <label className="task-form__field" htmlFor={`${idPrefix}-interval`}>
              <span>Repeat every</span>
              <input
                id={`${idPrefix}-interval`}
                type="number"
                min={1}
                value={values.recurrenceInterval}
                onChange={(event) =>
                  update('recurrenceInterval', Math.max(1, Number(event.target.value) || 1))
                }
              />
            </label>

            <label className="task-form__field" htmlFor={`${idPrefix}-unit`}>
              <span>Unit</span>
              <select
                id={`${idPrefix}-unit`}
                value={values.recurrenceUnit}
                onChange={(event) => update('recurrenceUnit', event.target.value as RecurrenceUnit)}
              >
                <option value="day">day(s)</option>
                <option value="week">week(s)</option>
                <option value="month">month(s)</option>
              </select>
            </label>
          </div>

          <label className="task-form__field" htmlFor={`${idPrefix}-due-date`}>
            <span>First / next due date (optional — defaults to today)</span>
            <input
              id={`${idPrefix}-due-date`}
              type="date"
              value={values.dueDate}
              onChange={(event) => update('dueDate', event.target.value)}
            />
          </label>

          <label className="task-form__field" htmlFor={`${idPrefix}-end-date`}>
            <span>End recurrence on (optional)</span>
            <input
              id={`${idPrefix}-end-date`}
              type="date"
              value={values.recurrenceEndDate}
              onChange={(event) => update('recurrenceEndDate', event.target.value)}
            />
          </label>
        </div>
      )}
    </fieldset>
  );
}

export function defaultRecurrenceFormValues(): RecurrenceFormValues {
  return {
    isRecurring: false,
    recurrenceInterval: 1,
    recurrenceUnit: 'day',
    dueDate: '',
    recurrenceEndDate: '',
  };
}

export function recurrencePayloadFromForm(values: RecurrenceFormValues) {
  if (!values.isRecurring) {
    return {
      is_recurring: false,
      recurrence_interval: null,
      recurrence_unit: null,
      recurrence_end_date: null,
      due_date: values.dueDate || null,
    };
  }

  return {
    is_recurring: true,
    recurrence_interval: values.recurrenceInterval,
    recurrence_unit: values.recurrenceUnit,
    recurrence_end_date: values.recurrenceEndDate || null,
    due_date: values.dueDate || null,
  };
}

export function recurrenceFormValuesFromTask(task: {
  is_recurring: boolean;
  recurrence_interval: number | null;
  recurrence_unit: RecurrenceUnit | null;
  due_date: string | null;
  recurrence_end_date?: string | null;
}): RecurrenceFormValues {
  return {
    isRecurring: task.is_recurring,
    recurrenceInterval: task.recurrence_interval ?? 1,
    recurrenceUnit: task.recurrence_unit ?? 'day',
    dueDate: task.due_date ?? '',
    recurrenceEndDate: task.recurrence_end_date ?? '',
  };
}
