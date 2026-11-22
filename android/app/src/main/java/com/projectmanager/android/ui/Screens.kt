package com.projectmanager.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.DragHandle
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.Menu
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberDrawerState
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.projectmanager.android.data.ProjectEntity
import com.projectmanager.android.data.TaskEntity
import com.projectmanager.android.logic.isTaskVisible
import com.projectmanager.android.logic.recurrenceSummary
import com.projectmanager.android.logic.suggestNextDueDate
import kotlinx.coroutines.launch
import sh.calvin.reorderable.ReorderableItem
import sh.calvin.reorderable.rememberReorderableLazyListState
import java.time.LocalDate

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProjectApp(viewModel: AppViewModel) {
    val screen by viewModel.screen.collectAsStateSafe()
    if (!screen.signedIn) {
        AuthScreen(screen, viewModel)
    } else {
        MainScreen(screen, viewModel)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AuthScreen(screen: AccountScreen, viewModel: AppViewModel) {
    var mode by remember { mutableStateOf("login") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var server by remember(screen.serverUrl) { mutableStateOf(screen.serverUrl) }

    Scaffold { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                if (mode == "login") "Sign in" else "Create account",
                style = MaterialTheme.typography.headlineMedium,
            )
            Text(
                "Same email and password as the website. The phone keeps you signed in for 21 days.",
                style = MaterialTheme.typography.bodyMedium,
            )
            if (mode == "signup") {
                OutlinedTextField(name, { name = it }, label = { Text("Name") }, modifier = Modifier.fillMaxWidth())
            }
            OutlinedTextField(email, { email = it }, label = { Text("Email") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(password, { password = it }, label = { Text("Password") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(
                server,
                { server = it },
                label = { Text("Server") },
                modifier = Modifier.fillMaxWidth(),
                supportingText = { Text("The Render address for your account.") },
            )
            screen.message?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            Button(
                onClick = {
                    if (mode == "login") viewModel.login(email, password, server)
                    else viewModel.signup(email, password, name, server)
                },
                enabled = !screen.busy && email.isNotBlank() && password.length >= 8,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (screen.busy) "Please wait" else if (mode == "login") "Sign in" else "Create account")
            }
            TextButton(onClick = { mode = if (mode == "login") "signup" else "login" }) {
                Text(if (mode == "login") "Need an account? Sign up" else "Already have an account? Sign in")
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MainScreen(screen: AccountScreen, viewModel: AppViewModel) {
    val drawerState = rememberDrawerState(androidx.compose.material3.DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    var editingTask by remember { mutableStateOf<TaskEntity?>(null) }
    var pendingDue by remember { mutableStateOf<TaskEntity?>(null) }
    var pendingDelete by remember { mutableStateOf<Pair<String, Long>?>(null) }
    var showCreateTask by remember { mutableStateOf(false) }
    var editingProject by remember { mutableStateOf<ProjectEntity?>(null) }
    var renamingWorkspace by remember { mutableStateOf<Long?>(null) }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet {
            DrawerContent(
                screen = screen,
                onSelectWorkspace = {
                    viewModel.selectWorkspace(it)
                    scope.launch { drawerState.close() }
                },
                onSelectProject = { viewModel.selectProject(it) },
                onCreateWorkspace = viewModel::createWorkspace,
                onRenameWorkspace = { renamingWorkspace = it },
                onDeleteWorkspace = { id, name -> pendingDelete = "workspace:$name" to id },
                onCreateProject = viewModel::createProject,
                onEditProject = { editingProject = it },
                onToggleProject = viewModel::setProjectCompleted,
                onDeleteProject = { id, name -> pendingDelete = "project:$name" to id },
                onShowCompleted = viewModel::setShowCompleted,
                onLogout = viewModel::logout,
            )
            }
        },
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        val name = screen.workspaces.firstOrNull { it.id == screen.selectedWorkspaceId }?.name
                        Text(name ?: "Tasks")
                    },
                    navigationIcon = {
                        IconButton(onClick = { scope.launch { drawerState.open() } }) {
                            Icon(Icons.Rounded.Menu, contentDescription = "Open menu")
                        }
                    },
                    actions = {
                        IconButton(onClick = { showCreateTask = true }) {
                            Icon(Icons.Rounded.Add, contentDescription = "Create task")
                        }
                    },
                )
            },
        ) { padding ->
            Column(Modifier.fillMaxSize().padding(padding)) {
                SyncLine(screen, viewModel)
                screen.message?.let {
                    Text(
                        it,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                    )
                }
                val workspaceId = screen.selectedWorkspaceId
                if (screen.sync?.snapshotComplete != true && screen.workspaces.isEmpty()) {
                    Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        CircularProgressIndicator()
                        Text(screen.sync?.detail ?: "Loading your tasks. The server can take about a minute to wake.")
                        Button(onClick = viewModel::syncNow) { Text("Try again") }
                    }
                } else if (workspaceId == null) {
                    Text("Add a workspace from the menu.", modifier = Modifier.padding(24.dp))
                } else {
                    PriorityList(
                        screen = screen,
                        workspaceId = workspaceId,
                        onFilterProject = { viewModel.setProjectFilter(workspaceId, it) },
                        onFilterStatus = { viewModel.setStatusFilter(workspaceId, it) },
                        onToggle = { task, checked ->
                            if (checked && task.isRecurring && !task.isCompleted) {
                                pendingDue = task
                            } else if (checked) {
                                viewModel.completeTask(task.id, null)
                            } else {
                                viewModel.saveTask(task.id, mapOf("is_completed" to false))
                            }
                        },
                        onEdit = { editingTask = it },
                        onDelete = { pendingDelete = "task:${it.title}" to it.id },
                        onReorder = { visibleIds, newOrder ->
                            val full = fullWorkspaceTasks(screen, workspaceId).map { it.id }
                            viewModel.reorderVisible(full, visibleIds, newOrder)
                        },
                    )
                }
            }
        }
    }

    var hideReauth by remember { mutableStateOf(false) }
    LaunchedEffect(screen.sync?.needsReauth) {
        if (screen.sync?.needsReauth != true) {
            hideReauth = false
        }
    }
    if (screen.sync?.needsReauth == true && !hideReauth) {
        ReauthDialog(screen.serverUrl, screen.busy, screen.message, viewModel) { hideReauth = true }
    }
    editingTask?.let { task ->
        TaskEditor(task, screen.projects.filter { it.workspaceId == task.workspaceId && !it.isCompleted }, { editingTask = null }) { changes ->
            viewModel.saveTask(task.id, changes)
            editingTask = null
        }
    }
    if (showCreateTask) {
        CreateTaskSheet(screen, { showCreateTask = false }, viewModel)
    }
    pendingDue?.let { task ->
        NextDueDialog(task, { pendingDue = null }) { date ->
            viewModel.completeTask(task.id, date)
            pendingDue = null
        }
    }
    pendingDelete?.let { (label, id) ->
        val kind = label.substringBefore(":")
        val name = label.substringAfter(":")
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            title = { Text("Delete $name?") },
            text = { Text("This removes it from the phone and uploads the delete.") },
            confirmButton = {
                TextButton(onClick = {
                    when (kind) {
                        "workspace" -> viewModel.deleteWorkspace(id)
                        "project" -> viewModel.deleteProject(id)
                        else -> viewModel.deleteTask(id)
                    }
                    pendingDelete = null
                }) { Text("Delete") }
            },
            dismissButton = { TextButton(onClick = { pendingDelete = null }) { Text("Cancel") } },
        )
    }
    renamingWorkspace?.let { id ->
        val current = screen.workspaces.firstOrNull { it.id == id }
        var name by remember(id) { mutableStateOf(current?.name.orEmpty()) }
        AlertDialog(
            onDismissRequest = { renamingWorkspace = null },
            title = { Text("Rename workspace") },
            text = { OutlinedTextField(name, { name = it }, label = { Text("Name") }) },
            confirmButton = {
                TextButton(onClick = {
                    if (name.isNotBlank()) viewModel.renameWorkspace(id, name)
                    renamingWorkspace = null
                }) { Text("Save") }
            },
            dismissButton = { TextButton(onClick = { renamingWorkspace = null }) { Text("Cancel") } },
        )
    }
    editingProject?.let { project ->
        ProjectEditor(project, screen.workspaces, { editingProject = null }, viewModel)
    }
}

@Composable
private fun SyncLine(screen: AccountScreen, viewModel: AppViewModel) {
    val detail = screen.sync?.detail?.takeIf { it.isNotBlank() } ?: "Up to date"
    TextButton(onClick = viewModel::syncNow, modifier = Modifier.padding(horizontal = 8.dp)) {
        Text(detail, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun DrawerContent(
    screen: AccountScreen,
    onSelectWorkspace: (Long) -> Unit,
    onSelectProject: (Long) -> Unit,
    onCreateWorkspace: (String) -> Unit,
    onRenameWorkspace: (Long) -> Unit,
    onDeleteWorkspace: (Long, String) -> Unit,
    onCreateProject: (Long, String, String, String?) -> Unit,
    onEditProject: (ProjectEntity) -> Unit,
    onToggleProject: (Long, Boolean) -> Unit,
    onDeleteProject: (Long, String) -> Unit,
    onShowCompleted: (Boolean) -> Unit,
    onLogout: () -> Unit,
) {
    var workspaceName by remember { mutableStateOf("") }
    var projectTitle by remember { mutableStateOf("") }
    val workspaceId = screen.selectedWorkspaceId
    Column(Modifier.fillMaxSize().padding(12.dp)) {
        Text("Workspaces", style = MaterialTheme.typography.titleMedium)
        LazyColumn(Modifier.weight(1f)) {
            items(screen.workspaces, key = { it.id }) { workspace ->
                NavigationDrawerItem(
                    label = { Text(workspace.name) },
                    selected = workspace.id == workspaceId,
                    onClick = { onSelectWorkspace(workspace.id) },
                    badge = {
                        Row {
                            IconButton(onClick = { onRenameWorkspace(workspace.id) }) {
                                Icon(Icons.Rounded.Edit, contentDescription = "Rename ${workspace.name}")
                            }
                            IconButton(onClick = { onDeleteWorkspace(workspace.id, workspace.name) }) {
                                Icon(Icons.Rounded.Delete, contentDescription = "Delete ${workspace.name}")
                            }
                        }
                    },
                )
            }
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(
                        workspaceName,
                        { workspaceName = it },
                        label = { Text("New workspace") },
                        modifier = Modifier.weight(1f),
                    )
                    IconButton(onClick = {
                        if (workspaceName.isNotBlank()) {
                            onCreateWorkspace(workspaceName)
                            workspaceName = ""
                        }
                    }) { Icon(Icons.Rounded.Add, contentDescription = "Add workspace") }
                }
            }
            if (workspaceId != null) {
                item { HorizontalDivider(Modifier.padding(vertical = 8.dp)) }
                item { Text("Projects", style = MaterialTheme.typography.titleMedium) }
                val active = screen.projects.filter { it.workspaceId == workspaceId && !it.isCompleted }
                val done = screen.projects.filter { it.workspaceId == workspaceId && it.isCompleted }
                items(active, key = { it.id }) { project ->
                    ProjectRow(project, project.id == screen.selectedProjectId, onSelectProject, onEditProject, onToggleProject, onDeleteProject)
                }
                item {
                    TextButton(onClick = { onShowCompleted(!screen.showCompletedProjects) }) {
                        Text(if (screen.showCompletedProjects) "Hide completed" else "Completed (${done.size})")
                    }
                }
                if (screen.showCompletedProjects) {
                    items(done, key = { "done-${it.id}" }) { project ->
                        ProjectRow(project, false, onSelectProject, onEditProject, onToggleProject, onDeleteProject)
                    }
                }
                item {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        OutlinedTextField(
                            projectTitle,
                            { projectTitle = it },
                            label = { Text("New project") },
                            modifier = Modifier.weight(1f),
                        )
                        IconButton(onClick = {
                            if (projectTitle.isNotBlank()) {
                                onCreateProject(workspaceId, projectTitle, "", null)
                                projectTitle = ""
                            }
                        }) { Icon(Icons.Rounded.Add, contentDescription = "Add project") }
                    }
                }
            }
            item {
                Spacer(Modifier.height(12.dp))
                TextButton(onClick = onLogout) { Text("Log out") }
            }
        }
    }
}

@Composable
private fun ProjectRow(
    project: ProjectEntity,
    selected: Boolean,
    onSelect: (Long) -> Unit,
    onEdit: (ProjectEntity) -> Unit,
    onToggle: (Long, Boolean) -> Unit,
    onDelete: (Long, String) -> Unit,
) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        TextButton(onClick = { onSelect(project.id) }, modifier = Modifier.weight(1f)) {
            Text(
                if (selected) "• ${project.title}" else project.title,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        TextButton(onClick = { onToggle(project.id, !project.isCompleted) }) {
            Text(if (project.isCompleted) "Restore" else "Done")
        }
        IconButton(onClick = { onEdit(project) }) {
            Icon(Icons.Rounded.Edit, contentDescription = "Edit ${project.title}")
        }
        IconButton(onClick = { onDelete(project.id, project.title) }) {
            Icon(Icons.Rounded.Delete, contentDescription = "Delete ${project.title}")
        }
    }
}

@Composable
private fun PriorityList(
    screen: AccountScreen,
    workspaceId: Long,
    onFilterProject: (Long?) -> Unit,
    onFilterStatus: (String) -> Unit,
    onToggle: (TaskEntity, Boolean) -> Unit,
    onEdit: (TaskEntity) -> Unit,
    onDelete: (TaskEntity) -> Unit,
    onReorder: (Set<Long>, List<Long>) -> Unit,
) {
    val today = LocalDate.now().toString()
    val full = fullWorkspaceTasks(screen, workspaceId)
    val visible = full.filter { task ->
        (screen.projectFilterId == null || task.projectId == screen.projectFilterId) &&
            isTaskVisible(task.isRecurring, task.isCompleted, task.dueDate, screen.statusFilter, today)
    }
    val canDrag = screen.statusFilter == "active" || screen.statusFilter == "all"
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.padding(horizontal = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(
                selected = screen.projectFilterId == null,
                onClick = { onFilterProject(null) },
                label = { Text("All projects") },
            )
            screen.projects.filter { it.workspaceId == workspaceId && !it.isCompleted }.forEach { project ->
                FilterChip(
                    selected = screen.projectFilterId == project.id,
                    onClick = { onFilterProject(project.id) },
                    label = { Text(project.title, maxLines = 1) },
                )
            }
        }
        Row(Modifier.padding(horizontal = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("active" to "Active", "scheduled" to "Scheduled", "completed" to "Completed", "all" to "All").forEach { (value, label) ->
                FilterChip(
                    selected = screen.statusFilter == value,
                    onClick = { onFilterStatus(value) },
                    label = { Text(label) },
                )
            }
        }
        if (visible.isEmpty()) {
            Text("Nothing in this list.", modifier = Modifier.padding(16.dp))
            return
        }
        if (!canDrag) {
            LazyColumn(contentPadding = PaddingValues(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(visible, key = { it.id }) { task ->
                    TaskRow(task, screen, false, Modifier, onToggle, onEdit, onDelete)
                }
            }
            return
        }
        DraggableTasks(visible, screen, onToggle, onEdit, onDelete, onReorder)
    }
}

@Composable
private fun DraggableTasks(
    visible: List<TaskEntity>,
    screen: AccountScreen,
    onToggle: (TaskEntity, Boolean) -> Unit,
    onEdit: (TaskEntity) -> Unit,
    onDelete: (TaskEntity) -> Unit,
    onReorder: (Set<Long>, List<Long>) -> Unit,
) {
    var order by remember(visible.joinToString { it.id.toString() }) { mutableStateOf(visible) }
    var moved by remember(visible.joinToString { it.id.toString() }) { mutableStateOf(false) }
    val lazyListState = rememberLazyListState()
    val reorderState = rememberReorderableLazyListState(lazyListState) { from, to ->
        order = order.toMutableList().apply { add(to.index, removeAt(from.index)) }
        moved = true
    }
    LazyColumn(
        state = lazyListState,
        contentPadding = PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.fillMaxSize(),
    ) {
        items(order, key = { it.id }) { task ->
            ReorderableItem(reorderState, key = task.id) { _ ->
                TaskRow(
                    task,
                    screen,
                    true,
                    Modifier.draggableHandle(onDragStopped = {
                        if (moved) {
                            onReorder(visible.map { it.id }.toSet(), order.map { it.id })
                            moved = false
                        }
                    }),
                    onToggle,
                    onEdit,
                    onDelete,
                )
            }
        }
    }
}

@Composable
private fun TaskRow(
    task: TaskEntity,
    screen: AccountScreen,
    draggable: Boolean,
    dragModifier: Modifier,
    onToggle: (TaskEntity, Boolean) -> Unit,
    onEdit: (TaskEntity) -> Unit,
    onDelete: (TaskEntity) -> Unit,
) {
    val project = screen.projects.firstOrNull { it.id == task.projectId }?.title ?: "Project"
    Surface(tonalElevation = 1.dp, modifier = Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(4.dp)) {
            Checkbox(checked = task.isCompleted, onCheckedChange = { onToggle(task, it) })
            Column(Modifier.weight(1f)) {
                Text(task.title, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Text("$project${task.dueDate?.let { " · $it" } ?: ""}", style = MaterialTheme.typography.bodySmall)
                recurrenceSummary(
                    task.isRecurring,
                    task.recurrenceInterval,
                    task.recurrenceUnit,
                    task.dueDate,
                    task.recurrenceEndDate,
                )?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
            }
            if (draggable) {
                IconButton(onClick = {}, modifier = dragModifier) {
                    Icon(Icons.Rounded.DragHandle, contentDescription = "Reorder ${task.title}")
                }
            }
            IconButton(onClick = { onEdit(task) }) {
                Icon(Icons.Rounded.Edit, contentDescription = "Edit ${task.title}")
            }
            IconButton(onClick = { onDelete(task) }) {
                Icon(Icons.Rounded.Delete, contentDescription = "Delete ${task.title}")
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CreateTaskSheet(screen: AccountScreen, onClose: () -> Unit, viewModel: AppViewModel) {
    val projects = screen.projects.filter { it.workspaceId == screen.selectedWorkspaceId && !it.isCompleted }
    var projectId by remember { mutableStateOf(screen.selectedProjectId ?: projects.firstOrNull()?.id) }
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var due by remember { mutableStateOf("") }
    var recurring by remember { mutableStateOf(false) }
    var interval by remember { mutableStateOf("1") }
    var unit by remember { mutableStateOf("day") }
    var end by remember { mutableStateOf("") }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(onDismissRequest = onClose, sheetState = sheetState) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Create task", style = MaterialTheme.typography.titleLarge)
            if (projects.isEmpty()) {
                Text("Select or create a project in the menu first.")
            } else {
                projects.forEach { project ->
                    FilterChip(
                        selected = projectId == project.id,
                        onClick = { projectId = project.id },
                        label = { Text(project.title) },
                    )
                }
                OutlinedTextField(title, { title = it }, label = { Text("Title") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(description, { description = it }, label = { Text("Description") }, modifier = Modifier.fillMaxWidth())
                RecurrenceFields(due, { due = it }, recurring, { recurring = it }, interval, { interval = it }, unit, { unit = it }, end, { end = it })
                Button(
                    onClick = {
                        val id = projectId ?: return@Button
                        viewModel.createTask(
                            id,
                            title,
                            description,
                            due.blankToNull(),
                            recurring,
                            interval.toIntOrNull(),
                            unit,
                            end.blankToNull(),
                        )
                        onClose()
                    },
                    enabled = title.isNotBlank() && projectId != null,
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Add task") }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TaskEditor(
    task: TaskEntity,
    projects: List<ProjectEntity>,
    onClose: () -> Unit,
    onSave: (Map<String, Any?>) -> Unit,
) {
    var title by remember(task.id) { mutableStateOf(task.title) }
    var description by remember(task.id) { mutableStateOf(task.description) }
    var due by remember(task.id) { mutableStateOf(task.dueDate.orEmpty()) }
    var recurring by remember(task.id) { mutableStateOf(task.isRecurring) }
    var interval by remember(task.id) { mutableStateOf((task.recurrenceInterval ?: 1).toString()) }
    var unit by remember(task.id) { mutableStateOf(task.recurrenceUnit ?: "day") }
    var end by remember(task.id) { mutableStateOf(task.recurrenceEndDate.orEmpty()) }
    var projectId by remember(task.id) { mutableStateOf(task.projectId) }
    ModalBottomSheet(onDismissRequest = onClose) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Edit task", style = MaterialTheme.typography.titleLarge)
            OutlinedTextField(title, { title = it }, label = { Text("Title") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(description, { description = it }, label = { Text("Description") }, modifier = Modifier.fillMaxWidth())
            projects.forEach { project ->
                FilterChip(selected = projectId == project.id, onClick = { projectId = project.id }, label = { Text(project.title) })
            }
            RecurrenceFields(due, { due = it }, recurring, { recurring = it }, interval, { interval = it }, unit, { unit = it }, end, { end = it })
            Button(
                onClick = {
                    val changes = linkedMapOf<String, Any?>()
                    if (title != task.title) changes["title"] = title.trim()
                    if (description != task.description) changes["description"] = description.trim()
                    if (due.blankToNull() != task.dueDate) changes["due_date"] = due.blankToNull()
                    if (projectId != task.projectId) changes["project_id"] = projectId
                    if (recurring != task.isRecurring) changes["is_recurring"] = recurring
                    if (recurring) {
                        changes["recurrence_interval"] = interval.toIntOrNull() ?: 1
                        changes["recurrence_unit"] = unit
                        changes["recurrence_end_date"] = end.blankToNull()
                    } else if (task.isRecurring) {
                        changes["is_recurring"] = false
                        changes["recurrence_interval"] = null
                        changes["recurrence_unit"] = null
                        changes["recurrence_end_date"] = null
                    }
                    onSave(changes)
                },
                enabled = title.isNotBlank(),
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Save") }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun RecurrenceFields(
    due: String,
    onDue: (String) -> Unit,
    recurring: Boolean,
    onRecurring: (Boolean) -> Unit,
    interval: String,
    onInterval: (String) -> Unit,
    unit: String,
    onUnit: (String) -> Unit,
    end: String,
    onEnd: (String) -> Unit,
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Checkbox(checked = recurring, onCheckedChange = onRecurring)
        Text("Recurring task")
    }
    OutlinedTextField(due, onDue, label = { Text("Due date (YYYY-MM-DD)") }, modifier = Modifier.fillMaxWidth())
    if (recurring) {
        OutlinedTextField(interval, onInterval, label = { Text("Repeat every") }, modifier = Modifier.fillMaxWidth())
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("day", "week", "month").forEach { choice ->
                FilterChip(selected = unit == choice, onClick = { onUnit(choice) }, label = { Text(choice) })
            }
        }
        OutlinedTextField(end, onEnd, label = { Text("End date (optional)") }, modifier = Modifier.fillMaxWidth())
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ProjectEditor(
    project: ProjectEntity,
    workspaces: List<com.projectmanager.android.data.WorkspaceEntity>,
    onClose: () -> Unit,
    viewModel: AppViewModel,
) {
    var title by remember(project.id) { mutableStateOf(project.title) }
    var description by remember(project.id) { mutableStateOf(project.description) }
    var due by remember(project.id) { mutableStateOf(project.dueDate.orEmpty()) }
    var workspaceId by remember(project.id) { mutableStateOf(project.workspaceId) }
    ModalBottomSheet(onDismissRequest = onClose) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Edit project", style = MaterialTheme.typography.titleLarge)
            OutlinedTextField(title, { title = it }, label = { Text("Title") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(description, { description = it }, label = { Text("Description") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(due, { due = it }, label = { Text("Due date (YYYY-MM-DD)") }, modifier = Modifier.fillMaxWidth())
            workspaces.forEach { workspace ->
                FilterChip(
                    selected = workspaceId == workspace.id,
                    onClick = { workspaceId = workspace.id },
                    label = { Text(workspace.name) },
                )
            }
            Button(
                onClick = {
                    viewModel.updateProject(project.id, title.trim(), description.trim(), due.blankToNull(), project.isCompleted, workspaceId)
                    onClose()
                },
                enabled = title.isNotBlank(),
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Save") }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun NextDueDialog(task: TaskEntity, onDismiss: () -> Unit, onConfirm: (String) -> Unit) {
    val today = LocalDate.now().toString()
    val suggested = suggestNextDueDate(task.dueDate, task.recurrenceInterval, task.recurrenceUnit, today).orEmpty()
    var date by remember(task.id) { mutableStateOf(suggested) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Next due date") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Pick the next date for ${task.title}. Leave the suggestion to step one interval.")
                OutlinedTextField(date, { date = it }, label = { Text("YYYY-MM-DD") })
            }
        },
        confirmButton = {
            TextButton(onClick = { onConfirm(date.ifBlank { suggested }) }) { Text("Complete") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun ReauthDialog(
    server: String,
    busy: Boolean,
    message: String?,
    viewModel: AppViewModel,
    onLater: () -> Unit,
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onLater,
        title = { Text("Sign in again") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Your 21-day sign-in ended. Tasks already on this phone stay here.")
                OutlinedTextField(email, { email = it }, label = { Text("Email") })
                OutlinedTextField(password, { password = it }, label = { Text("Password") })
                message?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { viewModel.login(email, password, server) },
                enabled = !busy && email.isNotBlank() && password.isNotBlank(),
            ) { Text(if (busy) "Signing in" else "Sign in") }
        },
        dismissButton = { TextButton(onClick = onLater) { Text("Not now") } },
    )
}

private fun fullWorkspaceTasks(screen: AccountScreen, workspaceId: Long): List<TaskEntity> {
    val completed = screen.projects.filter { it.isCompleted }.map { it.id }.toSet()
    return screen.tasks
        .filter { it.workspaceId == workspaceId && it.projectId !in completed }
        .sortedWith(compareBy({ it.priorityIndex }, { it.id }))
}

private fun String.blankToNull(): String? = trim().ifBlank { null }

@Composable
private fun <T> kotlinx.coroutines.flow.StateFlow<T>.collectAsStateSafe(): State<T> {
    return collectAsState()
}
