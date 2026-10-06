"""Recurring completion stays on the schedule unless the user picks a date."""

import unittest
from datetime import date
from types import SimpleNamespace

from app.models.enums import RecurrenceUnit
from app.utils.recurrence import add_recurrence_interval, apply_recurring_completion


def _recurring_task(**overrides):
    values = {
        "is_recurring": True,
        "recurrence_interval": 1,
        "recurrence_unit": RecurrenceUnit.WEEK,
        "due_date": date(2026, 10, 3),
        "recurrence_end_date": None,
        "is_completed": True,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


class RecurrenceCompletionTests(unittest.TestCase):
    def test_weekly_interval_advances_from_the_due_date(self):
        self.assertEqual(
            add_recurrence_interval(date(2026, 10, 3), 1, RecurrenceUnit.WEEK),
            date(2026, 10, 10),
        )

    def test_month_interval_clamps_to_the_last_day(self):
        self.assertEqual(
            add_recurrence_interval(date(2026, 1, 31), 1, RecurrenceUnit.MONTH),
            date(2026, 2, 28),
        )

    def test_completion_without_a_chosen_date_keeps_the_schedule(self):
        task = _recurring_task()

        apply_recurring_completion(task)

        self.assertFalse(task.is_completed)
        self.assertEqual(task.due_date, date(2026, 10, 10))
        self.assertTrue(task.is_recurring)

    def test_chosen_next_date_replaces_the_schedule_suggestion(self):
        task = _recurring_task()

        apply_recurring_completion(task, next_due_date=date(2026, 10, 13))

        self.assertFalse(task.is_completed)
        self.assertEqual(task.due_date, date(2026, 10, 13))
        self.assertTrue(task.is_recurring)
        self.assertEqual(task.recurrence_interval, 1)

    def test_chosen_date_after_the_end_date_stops_recurrence(self):
        task = _recurring_task(recurrence_end_date=date(2026, 10, 8))

        apply_recurring_completion(task, next_due_date=date(2026, 10, 13))

        self.assertTrue(task.is_completed)
        self.assertEqual(task.due_date, date(2026, 10, 3))
        self.assertFalse(task.is_recurring)
        self.assertIsNone(task.recurrence_interval)
        self.assertIsNone(task.recurrence_unit)
        self.assertIsNone(task.recurrence_end_date)

    def test_chosen_date_on_the_end_date_still_schedules(self):
        task = _recurring_task(recurrence_end_date=date(2026, 10, 13))

        apply_recurring_completion(task, next_due_date=date(2026, 10, 13))

        self.assertFalse(task.is_completed)
        self.assertEqual(task.due_date, date(2026, 10, 13))
        self.assertTrue(task.is_recurring)


if __name__ == "__main__":
    unittest.main()
