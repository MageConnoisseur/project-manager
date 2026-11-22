package com.projectmanager.android.logic

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SyncLogicTest {
    @Test
    fun outboxRunsInIdOrder() {
        assertEquals(listOf(1L, 2L, 3L), orderedOutboxIds(listOf(3L, 1L, 2L)))
    }

    @Test
    fun rewriteReplacesTempIdsWithoutEatingLongerOnes() {
        val text = """{"workspace_id":-1,"project_id":-12,"note":"id -1"}"""
        val rewritten = rewriteNegativeIds(text, mapOf(-1L to 5L, -12L to 9L))
        assertEquals("""{"workspace_id":5,"project_id":9,"note":"id 5"}""", rewritten)
        assertFalse(containsUnmappedNegativeId(rewritten, emptyMap()))
    }

    @Test
    fun unmappedNegativeIdBlocksADependentWrite() {
        val text = """{"project_id":-4}"""
        assertTrue(containsUnmappedNegativeId(text, emptyMap()))
        assertFalse(containsUnmappedNegativeId(text, mapOf(-4L to 20L)))
    }

    @Test
    fun pullDoesNotReplaceAPendingField() {
        val local = sampleTask(title = "Phone title", isCompleted = true)
        val remote = sampleTask(title = "Website title", isCompleted = false)
        val merged = mergeTask(local, remote, setOf("title"))
        assertEquals("Phone title", merged.title)
        assertFalse(merged.isCompleted)
    }

    @Test
    fun pullAppliesFieldsThatAreNotWaiting() {
        val local = sampleTask(title = "Old", description = "Local notes")
        val remote = sampleTask(title = "Website title", description = "Server notes")
        val merged = mergeTask(local, remote, emptySet())
        assertEquals("Website title", merged.title)
        assertEquals("Server notes", merged.description)
    }

    @Test
    fun reorderKeepsPriorityPendingUntilItUploads() {
        val ops = listOf(
            PendingOp(
                id = 1,
                entityType = "reorder",
                localId = 0,
                fields = setOf("priority_index"),
                reorderTaskIds = setOf(7L, 8L),
            ),
        )
        assertEquals(setOf("priority_index"), pendingFields(ops, "task", 7L))
        assertTrue(pendingFields(ops, "task", 9L).isEmpty())
    }

    @Test
    fun filteredReorderKeepsHiddenTasksInTheirSlots() {
        val merged = mergeVisibleReorder(
            fullSortedIds = listOf(1L, 2L, 3L),
            visibleIds = setOf(1L, 3L),
            newVisibleOrder = listOf(3L, 1L),
        )
        assertEquals(listOf(3L, 2L, 1L), merged.map { it.first })
        assertEquals(listOf(0.0, 1.0, 2.0), merged.map { it.second })
    }

    @Test
    fun singleFlightDoesNotRunTwoSyncs() {
        val gate = SyncGate()
        assertTrue(gate.tryStart())
        assertFalse(gate.tryStart())
        assertTrue(gate.consumeAgain())
        assertFalse(gate.consumeAgain())
        gate.finish()
        assertTrue(gate.tryStart())
        gate.requestAgain()
        assertTrue(gate.consumeAgain())
        gate.finish()
    }

    @Test
    fun scheduledRecurringTaskIsHiddenFromTheActiveList() {
        assertTrue(
            isRecurringScheduledForFuture(
                isRecurring = true,
                isCompleted = false,
                dueDate = "2026-02-01",
                today = "2026-01-15",
            ),
        )
        assertFalse(
            isTaskVisible(
                isRecurring = true,
                isCompleted = false,
                dueDate = "2026-02-01",
                statusFilter = "active",
                today = "2026-01-15",
            ),
        )
        assertTrue(
            isTaskVisible(
                isRecurring = true,
                isCompleted = false,
                dueDate = "2026-02-01",
                statusFilter = "scheduled",
                today = "2026-01-15",
            ),
        )
    }

    @Test
    fun suggestedNextDueDateStepsOneDay() {
        assertEquals(
            "2026-01-02",
            suggestNextDueDate("2026-01-01", 1, "day", "2026-01-15"),
        )
    }

    private fun sampleTask(
        title: String = "Task",
        description: String = "",
        isCompleted: Boolean = false,
    ): MergeTask {
        return MergeTask(
            id = 1,
            projectId = 2,
            workspaceId = 3,
            title = title,
            description = description,
            dueDate = null,
            isCompleted = isCompleted,
            priorityIndex = 0.0,
            isRecurring = false,
            recurrenceInterval = null,
            recurrenceUnit = null,
            recurrenceEndDate = null,
            createdAt = "2026-01-01T00:00:00Z",
            updatedAt = "2026-01-01T00:00:00Z",
        )
    }
}
