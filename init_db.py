"""
Drop and recreate all tables, then insert seed data for local testing.

Usage (from project root):
    cp .env.example .env   # edit DATABASE_URL
    pip install -r requirements.txt
    python init_db.py
"""

import sys
from datetime import date

from sqlalchemy.exc import OperationalError
from sqlmodel import Session, SQLModel, select

from app.core.security import hash_password
from app.database import engine
from app.models import Project, RecurrenceUnit, Task, User, Workspace

# Plain-text password for seed users only (local testing). Use /auth/signup in production.
SEED_USER_PASSWORD = "password123"


def reset_database() -> None:
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)


def seed_data(session: Session) -> None:
    seed_password_hash = hash_password(SEED_USER_PASSWORD)

    alice = User(
        email="alice@example.com",
        display_name="Alice",
        password_hash=seed_password_hash,
    )
    bob = User(
        email="bob@example.com",
        display_name="Bob",
        password_hash=seed_password_hash,
    )
    session.add(alice)
    session.add(bob)
    session.flush()

    home = Workspace(user_id=alice.id, name="Home")
    work = Workspace(user_id=alice.id, name="Work")
    ondeck = Workspace(user_id=bob.id, name="Side Projects")
    session.add(home)
    session.add(work)
    session.add(ondeck)
    session.flush()

    kitchen_reno = Project(
        workspace_id=home.id,
        title="Kitchen Renovation",
        description="Countertops, cabinets, and appliance upgrades.",
        due_date=date(2026, 8, 15),
    )
    yard = Project(
        workspace_id=home.id,
        title="Yard Maintenance",
        description="Seasonal outdoor upkeep.",
    )
    product_launch = Project(
        workspace_id=work.id,
        title="Q3 Product Launch",
        description="Release checklist for the next major version.",
        due_date=date(2026, 9, 30),
    )
    session.add(kitchen_reno)
    session.add(yard)
    session.add(product_launch)
    session.flush()

    tasks = [
        Task(
            project_id=kitchen_reno.id,
            workspace_id=home.id,
            title="Measure counter space",
            description="Confirm dimensions before ordering materials.",
            priority_index=1.0,
            due_date=date(2026, 6, 10),
        ),
        Task(
            project_id=kitchen_reno.id,
            workspace_id=home.id,
            title="Schedule contractor walkthrough",
            description="Book for next Tuesday afternoon.",
            priority_index=2.0,
            is_completed=True,
            due_date=date(2026, 6, 5),
        ),
        Task(
            project_id=yard.id,
            workspace_id=home.id,
            title="Mow the lawn",
            description="Front and back yard.",
            priority_index=1.0,
            is_recurring=True,
            recurrence_interval=1,
            recurrence_unit=RecurrenceUnit.WEEK,
        ),
        Task(
            project_id=yard.id,
            workspace_id=home.id,
            title="Water vegetable garden",
            description="Check soil moisture first.",
            priority_index=2.0,
            is_recurring=True,
            recurrence_interval=3,
            recurrence_unit=RecurrenceUnit.DAY,
        ),
        Task(
            project_id=product_launch.id,
            workspace_id=work.id,
            title="Finalize release notes",
            description="Include breaking changes and migration steps.",
            priority_index=1.0,
            due_date=date(2026, 9, 20),
        ),
        Task(
            project_id=product_launch.id,
            workspace_id=work.id,
            title="Run staging smoke tests",
            description="Auth, billing, and task reorder flows.",
            priority_index=2.0,
        ),
        Task(
            project_id=product_launch.id,
            workspace_id=work.id,
            title="Prepare launch demo",
            description="Five-minute walkthrough for stakeholders.",
            priority_index=3.0,
            is_recurring=True,
            recurrence_interval=1,
            recurrence_unit=RecurrenceUnit.MONTH,
        ),
    ]
    session.add_all(tasks)
    session.commit()

    users = session.exec(select(User)).all()
    workspaces = session.exec(select(Workspace)).all()
    projects = session.exec(select(Project)).all()
    seeded_tasks = session.exec(select(Task)).all()

    print(
        f"Seeded {len(users)} users, {len(workspaces)} workspaces, "
        f"{len(projects)} projects, {len(seeded_tasks)} tasks."
    )
    print(
        f"Seed login (for Swagger /auth/token): email=alice@example.com "
        f"password={SEED_USER_PASSWORD}"
    )


def main() -> None:
    print("Dropping and recreating tables...")
    try:
        reset_database()
    except OperationalError as exc:
        print(
            "Could not connect to Postgres. Check DATABASE_URL in .env.\n"
            "For Neon: open your project in https://console.neon.tech, copy the connection string, "
            "and set DATABASE_URL=postgresql://...?sslmode=require",
            file=sys.stderr,
        )
        raise SystemExit(1) from exc

    with Session(engine) as session:
        print("Inserting seed data...")
        seed_data(session)

    print("Database initialization complete.")


if __name__ == "__main__":
    main()
