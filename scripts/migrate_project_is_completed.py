"""
Add is_completed to projects on an existing database.

Usage (from project root):
    python scripts/migrate_project_is_completed.py
"""

from sqlalchemy import text

from app.database import engine


def main() -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                ALTER TABLE projects
                ADD COLUMN IF NOT EXISTS is_completed BOOLEAN NOT NULL DEFAULT FALSE
                """
            )
        )
    print("Migration complete: projects.is_completed")


if __name__ == "__main__":
    main()
