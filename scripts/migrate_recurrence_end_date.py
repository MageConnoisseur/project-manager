"""
Add recurrence_end_date to tasks on an existing database.

Usage (from project root):
    python scripts/migrate_recurrence_end_date.py
"""

from sqlalchemy import text

from app.database import engine


def main() -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                ALTER TABLE tasks
                ADD COLUMN IF NOT EXISTS recurrence_end_date DATE
                """
            )
        )
    print("Migration complete: tasks.recurrence_end_date")


if __name__ == "__main__":
    main()
