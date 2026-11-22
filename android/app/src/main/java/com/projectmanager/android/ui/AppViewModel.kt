package com.projectmanager.android.ui

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.projectmanager.android.BuildConfig
import com.projectmanager.android.data.ApiClient
import com.projectmanager.android.data.ProjectEntity
import com.projectmanager.android.data.SessionStore
import com.projectmanager.android.data.SyncStateEntity
import com.projectmanager.android.data.TaskEntity
import com.projectmanager.android.data.WorkspaceEntity
import com.projectmanager.android.logic.mergeVisibleReorder
import com.projectmanager.android.sync.AppGraph
import com.projectmanager.android.sync.SyncScheduler
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class AccountScreen(
    val signedIn: Boolean = false,
    val workspaces: List<WorkspaceEntity> = emptyList(),
    val projects: List<ProjectEntity> = emptyList(),
    val tasks: List<TaskEntity> = emptyList(),
    val sync: SyncStateEntity? = null,
    val selectedWorkspaceId: Long? = null,
    val selectedProjectId: Long? = null,
    val projectFilterId: Long? = null,
    val statusFilter: String = "active",
    val showCompletedProjects: Boolean = false,
    val message: String? = null,
    val busy: Boolean = false,
    val serverUrl: String = "",
)

class AppViewModel(app: Application) : AndroidViewModel(app) {
    private val repo = AppGraph.repository
    private val session = AppGraph.session
    private val filters = app.getSharedPreferences("filters", Context.MODE_PRIVATE)
    private val selection = MutableStateFlow(Selection())
    private val message = MutableStateFlow<String?>(null)
    private val busy = MutableStateFlow(false)

    private data class Records(
        val workspaces: List<WorkspaceEntity>,
        val projects: List<ProjectEntity>,
        val tasks: List<TaskEntity>,
        val sync: SyncStateEntity?,
    )

    private val records = combine(
        repo.observeWorkspaces(),
        repo.observeProjects(),
        repo.observeTasks(),
        repo.observeSync(),
    ) { workspaces, projects, tasks, sync ->
        Records(workspaces, projects, tasks, sync)
    }

    val screen: StateFlow<AccountScreen> = combine(
        records,
        selection,
        message,
        busy,
    ) { records, selected, note, working ->
        val workspaceId = selected.workspaceId ?: records.workspaces.firstOrNull()?.id
        AccountScreen(
            signedIn = session.token() != null,
            workspaces = records.workspaces,
            projects = records.projects,
            tasks = records.tasks,
            sync = records.sync,
            selectedWorkspaceId = workspaceId,
            selectedProjectId = selected.projectId,
            projectFilterId = workspaceId?.let { readProjectFilter(it) },
            statusFilter = workspaceId?.let { filters.getString(statusKey(it), "active") } ?: "active",
            showCompletedProjects = selected.showCompleted,
            message = note,
            busy = working,
            serverUrl = session.serverUrl(BuildConfig.API_BASE_URL),
        )
    }.stateIn(
        viewModelScope,
        SharingStarted.WhileSubscribed(5_000),
        AccountScreen(
            signedIn = session.token() != null,
            serverUrl = session.serverUrl(BuildConfig.API_BASE_URL),
        ),
    )

    fun selectWorkspace(id: Long) {
        selection.value = selection.value.copy(workspaceId = id, projectId = null)
    }

    fun selectProject(id: Long) {
        selection.value = selection.value.copy(projectId = id)
    }

    fun setProjectFilter(workspaceId: Long, projectId: Long?) {
        val editor = filters.edit()
        if (projectId == null) {
            editor.remove(projectKey(workspaceId))
        } else {
            editor.putLong(projectKey(workspaceId), projectId)
        }
        editor.apply()
        selection.value = selection.value.copy(tick = selection.value.tick + 1)
    }

    fun setStatusFilter(workspaceId: Long, status: String) {
        filters.edit().putString(statusKey(workspaceId), status).apply()
        selection.value = selection.value.copy(tick = selection.value.tick + 1)
    }

    fun setShowCompleted(show: Boolean) {
        selection.value = selection.value.copy(showCompleted = show)
    }

    fun clearMessage() {
        message.value = null
    }

    fun login(email: String, password: String, server: String) {
        viewModelScope.launch {
            busy.value = true
            message.value = null
            try {
                val url = ApiClient.normalize(server.ifBlank { BuildConfig.API_BASE_URL })
                session.saveServer(url)
                repo.api = ApiClient(url)
                val previousUser = session.userId()
                val token = repo.api.login(email, password)
                val nextUser = SessionStore.jwtSubject(token)
                if (previousUser != null && previousUser != nextUser) {
                    repo.clearAccountData()
                }
                session.saveSession(token, url)
                selection.value = selection.value.copy(tick = selection.value.tick + 1)
                SyncScheduler.enqueue(getApplication())
            } catch (error: Exception) {
                message.value = error.message ?: "Could not sign in."
            } finally {
                busy.value = false
            }
        }
    }

    fun signup(email: String, password: String, displayName: String, server: String) {
        viewModelScope.launch {
            busy.value = true
            message.value = null
            try {
                val url = ApiClient.normalize(server.ifBlank { BuildConfig.API_BASE_URL })
                session.saveServer(url)
                repo.api = ApiClient(url)
                repo.api.signup(email, password, displayName)
                login(email, password, url)
            } catch (error: Exception) {
                message.value = error.message ?: "Could not create the account."
                busy.value = false
            }
        }
    }

    fun logout() {
        session.clearSession()
        selection.value = selection.value.copy(tick = selection.value.tick + 1)
    }

    fun syncNow() {
        SyncScheduler.enqueue(getApplication())
    }

    fun createWorkspace(name: String) = work { repo.createWorkspace(name) }

    fun renameWorkspace(id: Long, name: String) = work { repo.renameWorkspace(id, name) }

    fun deleteWorkspace(id: Long) = work { repo.deleteWorkspace(id) }

    fun createProject(workspaceId: Long, title: String, description: String, dueDate: String?) {
        work {
            repo.createProject(workspaceId, title, description, dueDate)
        }
    }

    fun updateProject(
        id: Long,
        title: String,
        description: String,
        dueDate: String?,
        isCompleted: Boolean,
        workspaceId: Long,
    ) = work {
        val current = screen.value.projects.firstOrNull { it.id == id } ?: return@work
        repo.updateProject(
            id = id,
            title = title,
            description = description,
            dueDate = dueDate,
            dueDateSet = dueDate != current.dueDate,
            isCompleted = if (isCompleted != current.isCompleted) isCompleted else null,
            workspaceId = if (workspaceId != current.workspaceId) workspaceId else null,
        )
    }

    fun setProjectCompleted(id: Long, completed: Boolean) = work {
        repo.updateProject(id, null, null, null, false, completed, null)
    }

    fun deleteProject(id: Long) = work { repo.deleteProject(id) }

    fun createTask(
        projectId: Long,
        title: String,
        description: String,
        dueDate: String?,
        isRecurring: Boolean,
        interval: Int?,
        unit: String?,
        endDate: String?,
    ) = work {
        repo.createTask(projectId, title, description, dueDate, isRecurring, interval, unit, endDate)
    }

    fun saveTask(id: Long, changes: Map<String, Any?>) = work { repo.updateTask(id, changes) }

    fun completeTask(id: Long, nextDueDate: String?) = work { repo.completeTask(id, nextDueDate) }

    fun deleteTask(id: Long) = work { repo.deleteTask(id) }

    fun reorderVisible(fullSortedIds: List<Long>, visibleIds: Set<Long>, newVisibleOrder: List<Long>) = work {
        repo.reorder(mergeVisibleReorder(fullSortedIds, visibleIds, newVisibleOrder))
    }

    private fun work(block: suspend () -> Unit) {
        viewModelScope.launch {
            try {
                block()
            } catch (error: Exception) {
                message.value = error.message ?: "Something went wrong."
            }
        }
    }

    private fun readProjectFilter(workspaceId: Long): Long? {
        if (!filters.contains(projectKey(workspaceId))) {
            return null
        }
        return filters.getLong(projectKey(workspaceId), Long.MIN_VALUE).takeIf { it != Long.MIN_VALUE }
    }

    private fun projectKey(workspaceId: Long) = "project-$workspaceId"
    private fun statusKey(workspaceId: Long) = "status-$workspaceId"

    private data class Selection(
        val workspaceId: Long? = null,
        val projectId: Long? = null,
        val showCompleted: Boolean = false,
        val tick: Int = 0,
    )
}
