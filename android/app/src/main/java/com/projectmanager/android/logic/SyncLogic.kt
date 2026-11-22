package com.projectmanager.android.logic

import java.util.ArrayDeque
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.abs

data class MergeWorkspace(
    val id: Long,
    val name: String,
    val createdAt: String,
    val updatedAt: String,
)

data class MergeProject(
    val id: Long,
    val workspaceId: Long,
    val title: String,
    val description: String,
    val dueDate: String?,
    val isCompleted: Boolean,
    val createdAt: String,
    val updatedAt: String,
)

data class MergeTask(
    val id: Long,
    val projectId: Long,
    val workspaceId: Long,
    val title: String,
    val description: String,
    val dueDate: String?,
    val isCompleted: Boolean,
    val priorityIndex: Double,
    val isRecurring: Boolean,
    val recurrenceInterval: Int?,
    val recurrenceUnit: String?,
    val recurrenceEndDate: String?,
    val createdAt: String,
    val updatedAt: String,
)

data class PendingOp(
    val id: Long,
    val entityType: String,
    val localId: Long,
    val fields: Set<String>,
    val reorderTaskIds: Set<Long> = emptySet(),
)

/**
 * Only one sync runs at a time. A second request sets [again] so the running
 * sync does another pass instead of starting a parallel one.
 */
class SyncGate {
    private val running = AtomicBoolean(false)
    private val again = AtomicBoolean(false)

    fun tryStart(): Boolean {
        if (!running.compareAndSet(false, true)) {
            again.set(true)
            return false
        }
        return true
    }

    fun requestAgain() {
        if (running.get()) {
            again.set(true)
        }
    }

    fun consumeAgain(): Boolean = again.getAndSet(false)

    fun finish() {
        running.set(false)
    }
}

fun orderedOutboxIds(ids: List<Long>): List<Long> = ids.sorted()

fun pendingFields(ops: List<PendingOp>, entityType: String, entityId: Long): Set<String> {
    val direct = ops
        .filter { it.entityType == entityType && it.localId == entityId }
        .flatMap { it.fields }
    val fromReorder = if (
        entityType == "task" &&
        ops.any { it.entityType == "reorder" && entityId in it.reorderTaskIds }
    ) {
        listOf("priority_index")
    } else {
        emptyList()
    }
    return (direct + fromReorder).toSet()
}

fun mergeWorkspace(local: MergeWorkspace, remote: MergeWorkspace, pending: Set<String>): MergeWorkspace {
    return local.copy(
        name = pick(pending, "name", local.name, remote.name),
        createdAt = remote.createdAt,
        updatedAt = remote.updatedAt,
    )
}

fun mergeProject(local: MergeProject, remote: MergeProject, pending: Set<String>): MergeProject {
    val keepList = "workspace_id" in pending
    return local.copy(
        workspaceId = if (keepList) local.workspaceId else remote.workspaceId,
        title = pick(pending, "title", local.title, remote.title),
        description = pick(pending, "description", local.description, remote.description),
        dueDate = pick(pending, "due_date", local.dueDate, remote.dueDate),
        isCompleted = pick(pending, "is_completed", local.isCompleted, remote.isCompleted),
        createdAt = remote.createdAt,
        updatedAt = remote.updatedAt,
    )
}

fun mergeTask(local: MergeTask, remote: MergeTask, pending: Set<String>): MergeTask {
    val keepProject = "project_id" in pending
    return local.copy(
        projectId = if (keepProject) local.projectId else remote.projectId,
        workspaceId = if (keepProject) local.workspaceId else remote.workspaceId,
        title = pick(pending, "title", local.title, remote.title),
        description = pick(pending, "description", local.description, remote.description),
        dueDate = pick(pending, "due_date", local.dueDate, remote.dueDate),
        isCompleted = pick(pending, "is_completed", local.isCompleted, remote.isCompleted),
        priorityIndex = pick(pending, "priority_index", local.priorityIndex, remote.priorityIndex),
        isRecurring = pick(pending, "is_recurring", local.isRecurring, remote.isRecurring),
        recurrenceInterval = pick(pending, "recurrence_interval", local.recurrenceInterval, remote.recurrenceInterval),
        recurrenceUnit = pick(pending, "recurrence_unit", local.recurrenceUnit, remote.recurrenceUnit),
        recurrenceEndDate = pick(pending, "recurrence_end_date", local.recurrenceEndDate, remote.recurrenceEndDate),
        createdAt = remote.createdAt,
        updatedAt = remote.updatedAt,
    )
}

fun rewriteNegativeIds(text: String, idMap: Map<Long, Long>): String {
    val sorted = idMap.keys.sortedByDescending { abs(it) }
    var result = text
    for (local in sorted) {
        val server = idMap.getValue(local)
        result = result.replace(Regex("(?<![0-9])$local(?![0-9])"), server.toString())
    }
    return result
}

fun containsUnmappedNegativeId(text: String, idMap: Map<Long, Long>): Boolean {
    val matches = Regex("(?<![0-9])-\\d+(?![0-9])").findAll(text)
    return matches.any { match ->
        val value = match.value.toLong()
        value < 0 && value !in idMap
    }
}

/**
 * Filtered drag-and-drop keeps tasks that are hidden in their current slots.
 * Visible tasks take those slots in the new order. Indexes are then 0..n-1.
 */
fun mergeVisibleReorder(
    fullSortedIds: List<Long>,
    visibleIds: Set<Long>,
    newVisibleOrder: List<Long>,
): List<Pair<Long, Double>> {
    val queue = ArrayDeque(newVisibleOrder)
    val merged = fullSortedIds.map { id ->
        if (id in visibleIds) queue.removeFirst() else id
    }
    return merged.mapIndexed { index, id -> id to index.toDouble() }
}

fun isRecurringScheduledForFuture(
    isRecurring: Boolean,
    isCompleted: Boolean,
    dueDate: String?,
    today: String,
): Boolean {
    return isRecurring && !isCompleted && dueDate != null && dueDate > today
}

fun isTaskVisible(
    isRecurring: Boolean,
    isCompleted: Boolean,
    dueDate: String?,
    statusFilter: String,
    today: String,
): Boolean {
    if (statusFilter == "all") {
        return true
    }
    if (statusFilter == "completed") {
        return isCompleted
    }
    if (statusFilter == "scheduled") {
        return isRecurringScheduledForFuture(isRecurring, isCompleted, dueDate, today)
    }
    return !isCompleted && !isRecurringScheduledForFuture(isRecurring, isCompleted, dueDate, today)
}

fun suggestNextDueDate(
    dueDate: String?,
    interval: Int?,
    unit: String?,
    today: String,
): String? {
    if (interval == null || interval < 1 || unit == null) {
        return null
    }
    return addInterval(dueDate ?: today, interval, unit)
}

fun addInterval(baseIso: String, interval: Int, unit: String): String {
    val parts = baseIso.split("-")
    if (parts.size != 3) {
        return baseIso
    }
    val year = parts[0].toInt()
    val month = parts[1].toInt()
    val day = parts[2].toInt()
    return when (unit) {
        "day" -> shiftDays(year, month, day, interval)
        "week" -> shiftDays(year, month, day, interval * 7)
        "month" -> shiftMonths(year, month, day, interval)
        else -> baseIso
    }
}

fun recurrenceSummary(
    isRecurring: Boolean,
    interval: Int?,
    unit: String?,
    dueDate: String?,
    endDate: String?,
): String? {
    if (!isRecurring || interval == null || unit == null) {
        return null
    }
    val unitLabel = if (interval == 1) unit else "${unit}s"
    val every = if (interval == 1) "Every" else "Every $interval"
    var summary = "$every $unitLabel"
    if (dueDate != null) {
        summary += " · next $dueDate"
    }
    if (endDate != null) {
        summary += " · ends $endDate"
    }
    return summary
}

private fun <T> pick(pending: Set<String>, field: String, local: T, remote: T): T {
    return if (field in pending) local else remote
}

private fun shiftDays(year: Int, month: Int, day: Int, days: Int): String {
    val utc = java.time.LocalDate.of(year, month, day).plusDays(days.toLong())
    return utc.toString()
}

private fun shiftMonths(year: Int, month: Int, day: Int, months: Int): String {
    val shifted = java.time.LocalDate.of(year, month, 1).plusMonths(months.toLong())
    val lastDay = shifted.lengthOfMonth()
    val clamped = java.time.LocalDate.of(shifted.year, shifted.monthValue, minOf(day, lastDay))
    return clamped.toString()
}
