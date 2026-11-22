"""
Add phone sync tables and the per-user revision counter.

Usage (from project root):
    python scripts/migrate_sync.py
"""

from sqlalchemy import text

from app.database import engine


def main() -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS sync_revision BIGINT NOT NULL DEFAULT 0
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS sync_changes (
                    id BIGSERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    revision BIGINT NOT NULL,
                    entity_type VARCHAR(32) NOT NULL,
                    entity_id INTEGER NOT NULL,
                    op VARCHAR(16) NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT uq_sync_change_user_revision UNIQUE (user_id, revision)
                )
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS ix_sync_changes_user_revision
                ON sync_changes (user_id, revision)
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS client_mutations (
                    id BIGSERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    idempotency_key VARCHAR(200) NOT NULL,
                    status_code INTEGER NOT NULL DEFAULT 0,
                    response_body TEXT NOT NULL DEFAULT '',
                    sync_revision BIGINT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT uq_client_mutation UNIQUE (user_id, idempotency_key)
                )
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS devices (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    device_id VARCHAR(64) NOT NULL,
                    fcm_token VARCHAR(512) NOT NULL,
                    platform VARCHAR(32) NOT NULL DEFAULT 'android',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT uq_user_device UNIQUE (user_id, device_id)
                )
                """
            )
        )
    print("Migration complete: sync_revision, sync_changes, client_mutations, devices")


if __name__ == "__main__":
    main()
