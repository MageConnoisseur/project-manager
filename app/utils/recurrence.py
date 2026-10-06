"""Helpers for recurring task due-date calculations."""

import calendar
from datetime import date, timedelta
from typing import Optional

from app.models.enums import RecurrenceUnit
from app.models.task import Task


def _add_months(base: date, months: int) -> date:
    """Advance a calendar date by whole months, clamping the day when needed."""
    month_index = base.month - 1 + months
    year = base.year + month_index // 12
    month = month_index % 12 + 1
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(base.day, last_day))


def add_recurrence_interval(base: date, interval: int, unit: RecurrenceUnit) -> date:
    """Return the next due date after applying interval + unit."""
    if unit == RecurrenceUnit.DAY:
        return base + timedelta(days=interval)
    if unit == RecurrenceUnit.WEEK:
        return base + timedelta(weeks=interval)
    if unit == RecurrenceUnit.MONTH:
        return _add_months(base, interval)
    raise ValueError(f"Unsupported recurrence unit: {unit}")


def default_due_date_for_recurring_task(due_date: Optional[date]) -> date:
    """Recurring tasks need a schedule anchor; default to today when unset."""
    return due_date or date.today()


def apply_recurring_completion(task: Task, next_due_date: Optional[date] = None) -> None:
    """
    When a recurring task is marked complete, schedule the next cycle.

    Resets is_completed so the task can reappear when its next due date arrives.
    The next due date is the date the user picked when one is provided. Otherwise
    it is one interval after the current due date, which keeps a fixed schedule
    even if the task was finished early or late.
    If the next due date would fall after recurrence_end_date, recurrence stops
    and the task is left completed with its current due date unchanged.
    """
    if not task.is_recurring or task.recurrence_interval is None or task.recurrence_unit is None:
        return

    if next_due_date is None:
        base = default_due_date_for_recurring_task(task.due_date)
        next_due = add_recurrence_interval(base, task.recurrence_interval, task.recurrence_unit)
    else:
        next_due = next_due_date

    if task.recurrence_end_date is not None and next_due > task.recurrence_end_date:
        task.is_recurring = False
        task.recurrence_interval = None
        task.recurrence_unit = None
        task.recurrence_end_date = None
        task.is_completed = True
        return

    task.is_completed = False
    task.due_date = next_due
