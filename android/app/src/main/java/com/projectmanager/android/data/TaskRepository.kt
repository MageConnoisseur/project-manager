package com.projectmanager.android.data

import com.projectmanager.android.logic.MergeProject
import com.projectmanager.android.logic.MergeTask
import com.projectmanager.android.logic.MergeWorkspace
import com.projectmanager.android.logic.PendingOp
import com.projectmanager.android.logic.containsUnmappedNegativeId
import com.projectmanager.android.logic.mergeProject
import com.projectmanager.android.logic.mergeTask
import com.projectmanager.android.logic.mergeWorkspace
import com.projectmanager.android.logic.pendingFields
import com.projectmanager.android.logic.rewriteNegativeIds
import androidx.room.withTransaction
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.util.UUID

class TaskRepository(
    private val db: AppDatabase,
    var api: ApiClient,
    private val session: SessionStore,
    private val requestSync: () -> Unit,
) {
    fun observeWorkspaces(): Flow<List<WorkspaceEntity>> = db.workspaces().observe()
    fun observeProjects(): Flow<List<ProjectEntity>> = db.projects().observe()
    fun observeTasks(): Flow<List<TaskEntity>> = db.tasks().observe()
    fun observeSync(): Flow<SyncStateEntity?> = db.syncState().observe()

    suspend fun createWorkspace(name: String) {
        val id = nextTempId()
        val now = nowStamp()
        db.workspaces().upsert(WorkspaceEntity(id, name.trim(), now, now))
        enqueue("POST", "lists", json(mapOf("name" to name.trim())), "workspace", id, emptySet())
    }

    suspend fun renameWorkspace(id: Long, name: String) {
        val current = db.workspaces().get(id) ?: return
        db.workspaces().upsert(current.copy(name = name.trim(), updatedAt = nowStamp()))
        enqueue("PUT", "lists/$id", json(mapOf("name" to name.trim())), "workspace", id, setOf("name"))
    }

    suspend fun deleteWorkspace(id: Long) {
        val projects = db.projects().inWorkspace(id)
        for (project in projects) {
            deleteProjectLocal(project.id)
        }
        db.workspaces().delete(id)
        db.outbox().deleteFor("workspace", id)
        if (id < 0) {
            return
        }
        enqueue("DELETE", "lists/$id", null, "workspace", id, emptySet())
    }

    suspend fun createProject(workspaceId: Long, title: String, description: String, dueDate: String?) {
        val id = nextTempId()
        val now = nowStamp()
        db.projects().upsert(
            ProjectEntity(
                id = id,
                workspaceId = workspaceId,
                title = title.trim(),
                description = description.trim(),
                dueDate = dueDate,
                isCompleted = false,
                createdAt = now,
                updatedAt = now,
            ),
        )
        val fields = mutableMapOf<String, Any?>(
            "workspace_id" to workspaceId,
            "title" to title.trim(),
            "description" to description.trim(),
        )
        if (dueDate != null) {
            fields["due_date"] = dueDate
        }
        enqueue("POST", "projects", json(fields), "project", id, emptySet())
    }

    suspend fun updateProject(
        id: Long,
        title: String?,
        description: String?,
        dueDate: String?,
        dueDateSet: Boolean,
        isCompleted: Boolean?,
        workspaceId: Long?,
    ) {
        val current = db.projects().get(id) ?: return
        val changed = linkedMapOf<String, Any?>()
        var next = current
        if (title != null && title != current.title) {
            next = next.copy(title = title.trim())
            changed["title"] = title.trim()
        }
        if (description != null && description != current.description) {
            next = next.copy(description = description)
            changed["description"] = description
        }
        if (dueDateSet && dueDate != current.dueDate) {
            next = next.copy(dueDate = dueDate)
            changed["due_date"] = dueDate
        }
        if (isCompleted != null && isCompleted != current.isCompleted) {
            next = next.copy(isCompleted = isCompleted)
            changed["is_completed"] = isCompleted
        }
        if (workspaceId != null && workspaceId != current.workspaceId) {
            next = next.copy(workspaceId = workspaceId)
            changed["workspace_id"] = workspaceId
            for (task in db.tasks().inProject(id)) {
                db.tasks().upsert(task.copy(workspaceId = workspaceId, updatedAt = nowStamp()))
            }
        }
        if (changed.isEmpty()) {
            return
        }
        db.projects().upsert(next.copy(updatedAt = nowStamp()))
        enqueue("PUT", "projects/$id", json(changed), "project", id, changed.keys)
    }

    suspend fun deleteProject(id: Long) {
        deleteProjectLocal(id)
        if (id < 0) {
            return
        }
        enqueue("DELETE", "projects/$id", null, "project", id, emptySet())
    }

    suspend fun createTask(
        projectId: Long,
        title: String,
        description: String,
        dueDate: String?,
        isRecurring: Boolean,
        interval: Int?,
        unit: String?,
        endDate: String?,
    ) {
        val project = db.projects().get(projectId) ?: return
        val id = nextTempId()
        val now = nowStamp()
        val tasks = db.tasks().inWorkspace(project.workspaceId)
        val priority = (tasks.maxOfOrNull { it.priorityIndex } ?: -1.0) + 1.0
        db.tasks().upsert(
            TaskEntity(
                id = id,
                projectId = projectId,
                workspaceId = project.workspaceId,
                title = title.trim(),
                description = description.trim(),
                dueDate = dueDate,
                isCompleted = false,
                priorityIndex = priority,
                isRecurring = isRecurring,
                recurrenceInterval = if (isRecurring) interval else null,
                recurrenceUnit = if (isRecurring) unit else null,
                recurrenceEndDate = if (isRecurring) endDate else null,
                createdAt = now,
                updatedAt = now,
            ),
        )
        val body = linkedMapOf<String, Any?>(
            "project_id" to projectId,
            "title" to title.trim(),
            "description" to description.trim(),
            "priority_index" to priority,
            "is_recurring" to isRecurring,
            "due_date" to dueDate,
        )
        if (isRecurring) {
            body["recurrence_interval"] = interval ?: 1
            body["recurrence_unit"] = unit ?: "day"
            body["recurrence_end_date"] = endDate
        }
        enqueue("POST", "tasks", json(body), "task", id, emptySet())
    }

    suspend fun updateTask(id: Long, changes: Map<String, Any?>) {
        val current = db.tasks().get(id) ?: return
        if (changes.isEmpty()) {
            return
        }
        var next = current
        if (changes.containsKey("title")) next = next.copy(title = changes["title"] as String)
        if (changes.containsKey("description")) next = next.copy(description = changes["description"] as String)
        if (changes.containsKey("due_date")) next = next.copy(dueDate = changes["due_date"] as String?)
        if (changes.containsKey("is_completed")) next = next.copy(isCompleted = changes["is_completed"] as Boolean)
        if (changes.containsKey("priority_index")) next = next.copy(priorityIndex = (changes["priority_index"] as Number).toDouble())
        if (changes.containsKey("is_recurring")) next = next.copy(isRecurring = changes["is_recurring"] as Boolean)
        if (changes.containsKey("recurrence_interval")) {
            next = next.copy(recurrenceInterval = (changes["recurrence_interval"] as Number?)?.toInt())
        }
        if (changes.containsKey("recurrence_unit")) next = next.copy(recurrenceUnit = changes["recurrence_unit"] as String?)
        if (changes.containsKey("recurrence_end_date")) {
            next = next.copy(recurrenceEndDate = changes["recurrence_end_date"] as String?)
        }
        if (changes.containsKey("project_id")) {
            val projectId = (changes["project_id"] as Number).toLong()
            val project = db.projects().get(projectId)
            next = next.copy(projectId = projectId, workspaceId = project?.workspaceId ?: next.workspaceId)
        }
        if (changes["is_recurring"] == false) {
            next = next.copy(recurrenceInterval = null, recurrenceUnit = null, recurrenceEndDate = null)
        }
        db.tasks().upsert(next.copy(updatedAt = nowStamp()))
        enqueue("PUT", "tasks/$id", json(changes), "task", id, changes.keys)
    }

    suspend fun completeTask(id: Long, nextDueDate: String?) {
        val changes = linkedMapOf<String, Any?>("is_completed" to true)
        if (nextDueDate != null) {
            changes["next_due_date"] = nextDueDate
        }
        val current = db.tasks().get(id) ?: return
        db.tasks().upsert(current.copy(isCompleted = true, updatedAt = nowStamp()))
        val fields = mutableSetOf("is_completed")
        if (nextDueDate != null) {
            fields.add("due_date")
        }
        enqueue("PUT", "tasks/$id", json(changes), "task", id, fields)
    }

    suspend fun deleteTask(id: Long) {
        db.tasks().delete(id)
        db.outbox().deleteFor("task", id)
        if (id < 0) {
            return
        }
        enqueue("DELETE", "tasks/$id", null, "task", id, emptySet())
    }

    suspend fun reorder(ordered: List<Pair<Long, Double>>) {
        val items = JSONArray()
        val ids = mutableListOf<Long>()
        for ((taskId, index) in ordered) {
            val task = db.tasks().get(taskId) ?: continue
            db.tasks().upsert(task.copy(priorityIndex = index, updatedAt = nowStamp()))
            ids.add(taskId)
            items.put(JSONObject().put("task_id", taskId).put("priority_index", index))
        }
        if (items.length() == 0) {
            return
        }
        enqueue(
            "PUT",
            "tasks/reorder",
            JSONObject().put("items", items).toString(),
            "reorder",
            0,
            setOf("priority_index"),
            reorderTaskIds = ids,
        )
    }

    suspend fun sync() {
        val token = session.tokenIfValid()
        if (token == null) {
            if (session.hasExpiredToken()) {
                updateState { it.copy(needsReauth = true, status = "auth", detail = "Sign in again to sync.") }
            }
            return
        }
        updateState { it.copy(needsReauth = false, status = "syncing", detail = "Syncing") }
        registerPush(token)
        pushOutbox(token)
        pull(token)
        val waiting = db.outbox().all().isNotEmpty()
        updateState {
            it.copy(
                status = if (waiting) "pending" else "idle",
                detail = if (waiting) "Saved on this phone. Uploading when the server answers." else "Up to date",
            )
        }
    }

    suspend fun clearAccountData() {
        withContext(Dispatchers.IO) {
            db.clearAllTables()
        }
        db.syncState().upsert(SyncStateEntity())
    }

    suspend fun markNeedsReauth() {
        updateState { it.copy(needsReauth = true, status = "auth", detail = "Sign in again to sync.") }
    }

    suspend fun noteOffline() {
        updateState { state ->
            val detail = if (state.snapshotComplete) {
                "Saved on this phone. Uploading when the server answers."
            } else {
                "Loading your tasks. The server can take about a minute to wake."
            }
            state.copy(status = "pending", detail = detail)
        }
    }

    private suspend fun registerPush(token: String) {
        val fcm = session.fcmToken() ?: return
        try {
            api.registerDevice(token, session.deviceId(), fcm)
        } catch (_: Exception) {
            // Push registration can wait. The list is already usable.
        }
    }

    private suspend fun pushOutbox(token: String) {
        val idMap = mutableMapOf<Long, Long>()
        while (true) {
            val op = db.outbox().all().firstOrNull() ?: return
            val path = rewriteNegativeIds(op.path, idMap)
            val body = op.bodyJson?.let { rewriteNegativeIds(it, idMap) }
            val combined = path + (body ?: "")
            if (containsUnmappedNegativeId(combined, idMap)) {
                updateState { it.copy(status = "pending", detail = "Waiting to upload a new item.") }
                return
            }
            try {
                val result = api.sendJson(op.method, path, body, token, session.deviceId(), op.mutationId)
                db.outbox().delete(op.id)
                rememberServerId(op, result.body, idMap)
            } catch (error: ApiException) {
                if (error.code == 404) {
                    dropMissing(op)
                    db.outbox().delete(op.id)
                    continue
                }
                updateState { it.copy(status = "error", detail = error.message ?: "Upload failed") }
                return
            }
        }
    }

    private suspend fun pull(token: String) {
        val state = ensureState()
        if (!state.snapshotComplete) {
            applySnapshot(api.snapshot(token))
            return
        }
        val payload = api.changes(token, state.revision)
        val revision = payload.getLong("revision")
        val changes = payload.getJSONArray("changes")
        for (index in 0 until changes.length()) {
            applyChange(changes.getJSONObject(index))
        }
        updateState { it.copy(revision = revision, snapshotComplete = true) }
    }

    private suspend fun applySnapshot(payload: JSONObject) {
        val remoteWorkspaceIds = mutableSetOf<Long>()
        val remoteProjectIds = mutableSetOf<Long>()
        val remoteTaskIds = mutableSetOf<Long>()
        val workspaces = payload.getJSONArray("workspaces")
        for (index in 0 until workspaces.length()) {
            val row = workspaceFromJson(workspaces.getJSONObject(index))
            remoteWorkspaceIds.add(row.id)
            upsertWorkspaceFromServer(row)
        }
        val projects = payload.getJSONArray("projects")
        for (index in 0 until projects.length()) {
            val row = projectFromJson(projects.getJSONObject(index))
            remoteProjectIds.add(row.id)
            upsertProjectFromServer(row)
        }
        val tasks = payload.getJSONArray("tasks")
        for (index in 0 until tasks.length()) {
            val row = taskFromJson(tasks.getJSONObject(index))
            remoteTaskIds.add(row.id)
            upsertTaskFromServer(row)
        }
        for (row in db.workspaces().all()) {
            if (row.id > 0 && row.id !in remoteWorkspaceIds) {
                db.workspaces().delete(row.id)
            }
        }
        for (row in db.projects().all()) {
            if (row.id > 0 && row.id !in remoteProjectIds) {
                db.projects().delete(row.id)
            }
        }
        for (row in db.tasks().all()) {
            if (row.id > 0 && row.id !in remoteTaskIds) {
                db.tasks().delete(row.id)
            }
        }
        updateState {
            it.copy(revision = payload.getLong("revision"), snapshotComplete = true)
        }
    }

    private suspend fun applyChange(change: JSONObject) {
        val type = change.getString("entity_type")
        val entityId = change.getLong("entity_id")
        val op = change.getString("op")
        if (op == "delete") {
            when (type) {
                "workspace" -> deleteWorkspaceLocal(entityId)
                "project" -> deleteProjectLocal(entityId)
                "task" -> {
                    db.tasks().delete(entityId)
                    db.outbox().deleteFor("task", entityId)
                }
            }
            return
        }
        when (type) {
            "workspace" -> change.optJSONObject("workspace")?.let {
                upsertWorkspaceFromServer(workspaceFromJson(it))
            }
            "project" -> change.optJSONObject("project")?.let {
                upsertProjectFromServer(projectFromJson(it))
            }
            "task" -> change.optJSONObject("task")?.let {
                upsertTaskFromServer(taskFromJson(it))
            }
        }
    }

    private suspend fun upsertWorkspaceFromServer(remote: WorkspaceEntity) {
        val local = db.workspaces().get(remote.id)
        val pending = pendingFields(loadPending(), "workspace", remote.id)
        val merged = if (local == null || pending.isEmpty()) {
            remote
        } else {
            val result = mergeWorkspace(local.toMerge(), remote.toMerge(), pending)
            local.copy(name = result.name, createdAt = result.createdAt, updatedAt = result.updatedAt)
        }
        db.workspaces().upsert(merged)
    }

    private suspend fun upsertProjectFromServer(remote: ProjectEntity) {
        val local = db.projects().get(remote.id)
        val pending = pendingFields(loadPending(), "project", remote.id)
        val merged = if (local == null || pending.isEmpty()) {
            remote
        } else {
            val result = mergeProject(local.toMerge(), remote.toMerge(), pending)
            remote.copy(
                workspaceId = result.workspaceId,
                title = result.title,
                description = result.description,
                dueDate = result.dueDate,
                isCompleted = result.isCompleted,
            )
        }
        db.projects().upsert(merged)
    }

    private suspend fun upsertTaskFromServer(remote: TaskEntity) {
        val local = db.tasks().get(remote.id)
        val pending = pendingFields(loadPending(), "task", remote.id)
        val merged = if (local == null || pending.isEmpty()) {
            remote
        } else {
            val result = mergeTask(local.toMerge(), remote.toMerge(), pending)
            remote.copy(
                projectId = result.projectId,
                workspaceId = result.workspaceId,
                title = result.title,
                description = result.description,
                dueDate = result.dueDate,
                isCompleted = result.isCompleted,
                priorityIndex = result.priorityIndex,
                isRecurring = result.isRecurring,
                recurrenceInterval = result.recurrenceInterval,
                recurrenceUnit = result.recurrenceUnit,
                recurrenceEndDate = result.recurrenceEndDate,
            )
        }
        db.tasks().upsert(merged)
    }

    private suspend fun rememberServerId(op: OutboxEntity, body: String, idMap: MutableMap<Long, Long>) {
        if (op.method != "POST" || body.isBlank()) {
            if (op.method == "PUT" && op.entityType == "task" && body.startsWith("{")) {
                upsertTaskFromServer(taskFromJson(JSONObject(body)))
            }
            return
        }
        val json = JSONObject(body)
        if (!json.has("id")) {
            return
        }
        val serverId = json.getLong("id")
        idMap[op.localId] = serverId
        db.withTransaction {
            when (op.entityType) {
                "workspace" -> {
                    val local = db.workspaces().get(op.localId)
                    if (local != null) {
                        db.workspaces().delete(op.localId)
                        db.workspaces().upsert(local.copy(id = serverId))
                    }
                    rewriteQueuedIds(op.localId, serverId)
                    upsertWorkspaceFromServer(workspaceFromJson(json).copy(id = serverId))
                    for (project in db.projects().inWorkspace(op.localId)) {
                        db.projects().upsert(project.copy(workspaceId = serverId))
                    }
                    for (task in db.tasks().inWorkspace(op.localId)) {
                        db.tasks().upsert(task.copy(workspaceId = serverId))
                    }
                }
                "project" -> {
                    val local = db.projects().get(op.localId)
                    if (local != null) {
                        db.projects().delete(op.localId)
                        db.projects().upsert(local.copy(id = serverId))
                    }
                    rewriteQueuedIds(op.localId, serverId)
                    upsertProjectFromServer(projectFromJson(json))
                    for (task in db.tasks().inProject(op.localId)) {
                        val project = db.projects().get(serverId)
                        db.tasks().upsert(
                            task.copy(
                                projectId = serverId,
                                workspaceId = project?.workspaceId ?: task.workspaceId,
                            ),
                        )
                    }
                }
                "task" -> {
                    val local = db.tasks().get(op.localId)
                    if (local != null) {
                        db.tasks().delete(op.localId)
                        db.tasks().upsert(local.copy(id = serverId))
                    }
                    rewriteQueuedIds(op.localId, serverId)
                    upsertTaskFromServer(taskFromJson(json))
                }
            }
        }
    }

    private suspend fun rewriteQueuedIds(localId: Long, serverId: Long) {
        val map = mapOf(localId to serverId)
        for (op in db.outbox().all()) {
            val path = rewriteNegativeIds(op.path, map)
            val body = op.bodyJson?.let { rewriteNegativeIds(it, map) }
            val fields = rewriteNegativeIds(op.fieldsJson, map)
            val nextLocalId = if (op.localId == localId && op.entityType != "reorder") serverId else op.localId
            if (path != op.path || body != op.bodyJson || fields != op.fieldsJson || nextLocalId != op.localId) {
                db.outbox().updatePayload(op.id, path, body, nextLocalId, fields)
            }
        }
    }

    private suspend fun dropMissing(op: OutboxEntity) {
        when (op.entityType) {
            "workspace" -> deleteWorkspaceLocal(op.localId)
            "project" -> deleteProjectLocal(op.localId)
            "task" -> {
                db.tasks().delete(op.localId)
                db.outbox().deleteFor("task", op.localId)
            }
        }
    }

    private suspend fun deleteProjectLocal(id: Long) {
        for (task in db.tasks().inProject(id)) {
            db.tasks().delete(task.id)
            db.outbox().deleteFor("task", task.id)
        }
        db.projects().delete(id)
        db.outbox().deleteFor("project", id)
    }

    private suspend fun deleteWorkspaceLocal(id: Long) {
        for (project in db.projects().inWorkspace(id)) {
            deleteProjectLocal(project.id)
        }
        db.workspaces().delete(id)
        db.outbox().deleteFor("workspace", id)
    }

    private suspend fun enqueue(
        method: String,
        path: String,
        body: String?,
        entityType: String,
        localId: Long,
        fields: Set<String>,
        reorderTaskIds: List<Long> = emptyList(),
    ) {
        val storedFields = if (entityType == "reorder") {
            JSONArray().put("priority_index").also { array ->
                reorderTaskIds.forEach { array.put(it) }
            }.toString()
        } else {
            JSONArray(fields.toList()).toString()
        }
        db.outbox().insert(
            OutboxEntity(
                mutationId = UUID.randomUUID().toString(),
                method = method,
                path = path,
                bodyJson = body,
                entityType = entityType,
                localId = localId,
                fieldsJson = storedFields,
            ),
        )
        updateState { it.copy(status = "pending", detail = "Saved on this phone. Uploading when the server answers.") }
        requestSync()
    }

    private suspend fun loadPending(): List<PendingOp> {
        return db.outbox().all().map { op ->
            val array = JSONArray(op.fieldsJson.ifBlank { "[]" })
            val fields = mutableSetOf<String>()
            val reorderIds = mutableSetOf<Long>()
            for (index in 0 until array.length()) {
                val value = array.opt(index)
                if (value is String) {
                    fields.add(value)
                } else if (value is Number) {
                    reorderIds.add(value.toLong())
                }
            }
            PendingOp(op.id, op.entityType, op.localId, fields, reorderIds)
        }
    }

    private suspend fun nextTempId(): Long {
        val state = ensureState()
        val id = state.nextTempId
        db.syncState().upsert(state.copy(nextTempId = id - 1))
        return id
    }

    private suspend fun ensureState(): SyncStateEntity {
        return db.syncState().get() ?: SyncStateEntity().also { db.syncState().upsert(it) }
    }

    private suspend fun updateState(block: (SyncStateEntity) -> SyncStateEntity) {
        val next = block(ensureState())
        db.syncState().upsert(next)
    }

    private fun json(fields: Map<String, Any?>): String {
        val obj = JSONObject()
        for ((key, value) in fields) {
            if (value == null) {
                obj.put(key, JSONObject.NULL)
            } else {
                obj.put(key, value)
            }
        }
        return obj.toString()
    }

    private fun nowStamp(): String = Instant.now().toString()
}

private fun WorkspaceEntity.toMerge() = MergeWorkspace(id, name, createdAt, updatedAt)

private fun ProjectEntity.toMerge() = MergeProject(
    id, workspaceId, title, description, dueDate, isCompleted, createdAt, updatedAt,
)

private fun TaskEntity.toMerge() = MergeTask(
    id, projectId, workspaceId, title, description, dueDate, isCompleted, priorityIndex,
    isRecurring, recurrenceInterval, recurrenceUnit, recurrenceEndDate, createdAt, updatedAt,
)

private fun workspaceFromJson(json: JSONObject) = WorkspaceEntity(
    id = json.getLong("id"),
    name = json.getString("name"),
    createdAt = json.getString("created_at"),
    updatedAt = json.getString("updated_at"),
)

private fun projectFromJson(json: JSONObject) = ProjectEntity(
    id = json.getLong("id"),
    workspaceId = json.getLong("workspace_id"),
    title = json.getString("title"),
    description = json.optString("description", ""),
    dueDate = json.optStringOrNull("due_date"),
    isCompleted = json.optBoolean("is_completed", false),
    createdAt = json.getString("created_at"),
    updatedAt = json.getString("updated_at"),
)

private fun taskFromJson(json: JSONObject) = TaskEntity(
    id = json.getLong("id"),
    projectId = json.getLong("project_id"),
    workspaceId = json.getLong("workspace_id"),
    title = json.getString("title"),
    description = json.optString("description", ""),
    dueDate = json.optStringOrNull("due_date"),
    isCompleted = json.optBoolean("is_completed", false),
    priorityIndex = json.optDouble("priority_index", 0.0),
    isRecurring = json.optBoolean("is_recurring", false),
    recurrenceInterval = if (json.isNull("recurrence_interval")) null else json.optInt("recurrence_interval"),
    recurrenceUnit = json.optStringOrNull("recurrence_unit"),
    recurrenceEndDate = json.optStringOrNull("recurrence_end_date"),
    createdAt = json.getString("created_at"),
    updatedAt = json.getString("updated_at"),
)

private fun JSONObject.optStringOrNull(key: String): String? {
    if (!has(key) || isNull(key)) {
        return null
    }
    return optString(key)
}
