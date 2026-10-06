"""Database timestamps must stay timezone-aware for current SQLModel."""

import unittest

from app.models.task import Task
from app.utils.time import utc_now


class TimestampTests(unittest.TestCase):
    def test_utc_now_includes_timezone(self):
        moment = utc_now()
        self.assertIsNotNone(moment.tzinfo)
        self.assertIsNotNone(moment.utcoffset())

    def test_new_task_timestamps_are_timezone_aware(self):
        task = Task(project_id=1, workspace_id=1, title="Check off")
        self.assertIsNotNone(task.created_at.utcoffset())
        self.assertIsNotNone(task.updated_at.utcoffset())


if __name__ == "__main__":
    unittest.main()
