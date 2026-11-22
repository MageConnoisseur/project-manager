"""Phone sync: revisions, partial updates, idempotency, and the 21-day token."""

import os
import time
import unittest

# Set before importing the app. create_engine runs at import and must not
# require a live Postgres driver just to load the test module.
os.environ["DATABASE_URL"] = "postgresql+psycopg2://test:test@localhost:5432/test"
os.environ["SECRET_KEY"] = "unit-test-secret-key-0123456789abcdef"
os.environ["FIREBASE_SERVICE_ACCOUNT_JSON"] = ""

from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, create_engine

from app import database
from app.config import ALGORITHM, SECRET_KEY
from app.main import app
from app.services.push import push_sync_revision

TEST_ENGINE = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
database.engine = TEST_ENGINE


class SyncApiTests(unittest.TestCase):
    def setUp(self):
        os.environ["FIREBASE_SERVICE_ACCOUNT_JSON"] = ""
        SQLModel.metadata.drop_all(TEST_ENGINE)
        SQLModel.metadata.create_all(TEST_ENGINE)
        self.client = TestClient(app)

    def _signup(self, email: str, name: str = "Ada") -> None:
        response = self.client.post(
            "/auth/signup",
            json={"email": email, "password": "password123", "display_name": name},
        )
        self.assertEqual(response.status_code, 201, response.text)

    def _login(self, email: str, client: str | None = None) -> str:
        form = {"username": email, "password": "password123"}
        if client is not None:
            form["client"] = client
        response = self.client.post("/auth/token", data=form)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["access_token"]

    def _auth(self, token: str, **extra: str) -> dict[str, str]:
        headers = {"Authorization": f"Bearer {token}"}
        headers.update(extra)
        return headers

    def _token_lifetime_seconds(self, token: str) -> float:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return float(payload["exp"]) - time.time()

    def _create_task(self, token: str, recurring: bool = False) -> dict:
        headers = self._auth(token)
        workspace = self.client.post("/lists", json={"name": "Home"}, headers=headers)
        self.assertEqual(workspace.status_code, 201, workspace.text)
        project = self.client.post(
            "/projects",
            json={"workspace_id": workspace.json()["id"], "title": "Kitchen"},
            headers=headers,
        )
        self.assertEqual(project.status_code, 201, project.text)
        body = {
            "project_id": project.json()["id"],
            "title": "Measure counters",
            "is_recurring": recurring,
        }
        if recurring:
            body.update(
                {
                    "recurrence_interval": 1,
                    "recurrence_unit": "day",
                    "due_date": "2026-01-01",
                }
            )
        task = self.client.post("/tasks", json=body, headers=headers)
        self.assertEqual(task.status_code, 201, task.text)
        return task.json()

    def test_website_token_stays_short_and_phone_token_lasts_21_days(self):
        self._signup("ada@example.com")
        website = self._login("ada@example.com")
        phone = self._login("ada@example.com", client="android")

        self.assertAlmostEqual(self._token_lifetime_seconds(website), 60 * 60, delta=120)
        self.assertAlmostEqual(
            self._token_lifetime_seconds(phone),
            21 * 24 * 60 * 60,
            delta=120,
        )

    def test_mutations_bump_revision_and_cascade_deletes(self):
        self._signup("ada@example.com")
        token = self._login("ada@example.com")
        headers = self._auth(token)

        created = self.client.post("/lists", json={"name": "Home"}, headers=headers)
        self.assertEqual(created.headers.get("x-sync-revision"), "1")
        workspace_id = created.json()["id"]

        project = self.client.post(
            "/projects",
            json={"workspace_id": workspace_id, "title": "Kitchen"},
            headers=headers,
        )
        task = self.client.post(
            "/tasks",
            json={"project_id": project.json()["id"], "title": "Measure"},
            headers=headers,
        )
        self.assertEqual(self.client.get("/sync/status", headers=headers).json()["revision"], 3)

        deleted = self.client.delete(f"/lists/{workspace_id}", headers=headers)
        self.assertEqual(deleted.status_code, 204)
        changes = self.client.get("/sync/changes", params={"since": 3}, headers=headers)
        self.assertEqual(changes.status_code, 200, changes.text)
        ops = {(item["entity_type"], item["op"]) for item in changes.json()["changes"]}
        self.assertEqual(
            ops,
            {("task", "delete"), ("project", "delete"), ("workspace", "delete")},
        )
        snapshot = self.client.get("/sync/snapshot", headers=headers).json()
        self.assertEqual(snapshot["workspaces"], [])
        self.assertEqual(snapshot["projects"], [])
        self.assertEqual(snapshot["tasks"], [])
        self.assertGreater(snapshot["revision"], 3)

    def test_partial_updates_keep_untouched_fields_and_last_commit_wins(self):
        self._signup("ada@example.com")
        token = self._login("ada@example.com")
        headers = self._auth(token)
        task = self._create_task(token)

        renamed = self.client.put(
            f"/tasks/{task['id']}",
            json={"title": "Website title"},
            headers=headers,
        )
        completed = self.client.put(
            f"/tasks/{task['id']}",
            json={"is_completed": True},
            headers=headers,
        )
        self.assertEqual(completed.status_code, 200, completed.text)
        self.assertEqual(completed.json()["title"], "Website title")
        self.assertTrue(completed.json()["is_completed"])
        self.assertEqual(renamed.json()["title"], "Website title")

        first = self.client.put(
            f"/tasks/{task['id']}",
            json={"title": "First"},
            headers=headers,
        )
        second = self.client.put(
            f"/tasks/{task['id']}",
            json={"title": "Second"},
            headers=headers,
        )
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.json()["title"], "Second")
        self.assertTrue(second.json()["is_completed"])

    def test_idempotent_recurring_completion_advances_once(self):
        self._signup("ada@example.com")
        token = self._login("ada@example.com")
        headers = self._auth(token, **{"Idempotency-Key": "complete-1"})
        task = self._create_task(token, recurring=True)

        first = self.client.put(
            f"/tasks/{task['id']}",
            json={"is_completed": True},
            headers=headers,
        )
        revision_after = self.client.get("/sync/status", headers=headers).json()["revision"]
        second = self.client.put(
            f"/tasks/{task['id']}",
            json={"is_completed": True},
            headers=headers,
        )

        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(second.status_code, 200, second.text)
        self.assertEqual(first.json(), second.json())
        self.assertEqual(first.json()["due_date"], "2026-01-02")
        self.assertFalse(first.json()["is_completed"])
        self.assertEqual(
            self.client.get("/sync/status", headers=headers).json()["revision"],
            revision_after,
        )

        again = self.client.put(
            f"/tasks/{task['id']}",
            json={"is_completed": True},
            headers=self._auth(token, **{"Idempotency-Key": "complete-2"}),
        )
        self.assertEqual(again.status_code, 200, again.text)
        self.assertEqual(again.json()["due_date"], "2026-01-03")

    def test_snapshot_and_changes_are_private_to_the_account(self):
        self._signup("ada@example.com", "Ada")
        self._signup("bob@example.com", "Bob")
        ada = self._login("ada@example.com")
        bob = self._login("bob@example.com")
        self._create_task(ada)

        ada_snapshot = self.client.get("/sync/snapshot", headers=self._auth(ada)).json()
        bob_snapshot = self.client.get("/sync/snapshot", headers=self._auth(bob)).json()
        self.assertEqual(len(ada_snapshot["tasks"]), 1)
        self.assertEqual(bob_snapshot["tasks"], [])
        self.assertEqual(bob_snapshot["revision"], 0)

        bob_changes = self.client.get(
            "/sync/changes",
            params={"since": 0},
            headers=self._auth(bob),
        )
        self.assertEqual(bob_changes.json()["changes"], [])

    def test_reorder_and_project_move_record_each_task(self):
        self._signup("ada@example.com")
        token = self._login("ada@example.com")
        headers = self._auth(token)
        task = self._create_task(token)
        other = self.client.post("/lists", json={"name": "Work"}, headers=headers)
        self.assertEqual(other.status_code, 201, other.text)

        before = self.client.get("/sync/status", headers=headers).json()["revision"]
        moved = self.client.put(
            f"/projects/{task['project_id']}",
            json={"workspace_id": other.json()["id"]},
            headers=headers,
        )
        self.assertEqual(moved.status_code, 200, moved.text)
        after_move = self.client.get("/sync/status", headers=headers).json()["revision"]
        self.assertGreaterEqual(after_move, before + 2)

        reordered = self.client.put(
            "/tasks/reorder",
            json={"items": [{"task_id": task["id"], "priority_index": 4}]},
            headers=headers,
        )
        self.assertEqual(reordered.status_code, 200, reordered.text)
        self.assertEqual(
            self.client.get("/sync/status", headers=headers).json()["revision"],
            after_move + 1,
        )

    def test_device_register_and_delete(self):
        self._signup("ada@example.com")
        token = self._login("ada@example.com", client="android")
        headers = self._auth(token)
        saved = self.client.post(
            "/devices",
            json={"device_id": "phone-1", "fcm_token": "token-1", "platform": "android"},
            headers=headers,
        )
        self.assertEqual(saved.status_code, 200, saved.text)
        replaced = self.client.post(
            "/devices",
            json={"device_id": "phone-1", "fcm_token": "token-2", "platform": "android"},
            headers=headers,
        )
        self.assertEqual(replaced.status_code, 200, replaced.text)
        removed = self.client.request(
            "DELETE",
            "/devices",
            json={"device_id": "phone-1"},
            headers=headers,
        )
        self.assertEqual(removed.status_code, 204, removed.text)

    def test_push_without_firebase_credentials_does_not_raise(self):
        push_sync_revision(user_id=1, revision=1, exclude_device_id=None)
        self._signup("ada@example.com")
        token = self._login("ada@example.com")
        response = self.client.post(
            "/lists",
            json={"name": "Home"},
            headers=self._auth(token),
        )
        self.assertEqual(response.status_code, 201, response.text)


if __name__ == "__main__":
    unittest.main()
