package com.projectmanager.android.data

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "workspaces")
data class WorkspaceEntity(
    @PrimaryKey val id: Long,
    val name: String,
    val createdAt: String,
    val updatedAt: String,
)

@Entity(tableName = "projects")
data class ProjectEntity(
    @PrimaryKey val id: Long,
    val workspaceId: Long,
    val title: String,
    val description: String,
    val dueDate: String?,
    val isCompleted: Boolean,
    val createdAt: String,
    val updatedAt: String,
)

@Entity(tableName = "tasks")
data class TaskEntity(
    @PrimaryKey val id: Long,
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

@Entity(tableName = "outbox")
data class OutboxEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val mutationId: String,
    val method: String,
    val path: String,
    val bodyJson: String?,
    val entityType: String,
    val localId: Long,
    val fieldsJson: String,
)

@Entity(tableName = "sync_state")
data class SyncStateEntity(
    @PrimaryKey val id: Int = 1,
    val revision: Long = 0,
    val snapshotComplete: Boolean = false,
    val nextTempId: Long = -1,
    val status: String = "idle",
    val detail: String = "",
    val needsReauth: Boolean = false,
)

@Dao
interface WorkspaceDao {
    @Query("SELECT * FROM workspaces ORDER BY id")
    fun observe(): Flow<List<WorkspaceEntity>>

    @Query("SELECT * FROM workspaces ORDER BY id")
    suspend fun all(): List<WorkspaceEntity>

    @Query("SELECT * FROM workspaces WHERE id = :id")
    suspend fun get(id: Long): WorkspaceEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(row: WorkspaceEntity)

    @Query("DELETE FROM workspaces WHERE id = :id")
    suspend fun delete(id: Long)

    @Query("DELETE FROM workspaces WHERE id > 0")
    suspend fun deleteServerRows()
}

@Dao
interface ProjectDao {
    @Query("SELECT * FROM projects ORDER BY id")
    fun observe(): Flow<List<ProjectEntity>>

    @Query("SELECT * FROM projects ORDER BY id")
    suspend fun all(): List<ProjectEntity>

    @Query("SELECT * FROM projects WHERE id = :id")
    suspend fun get(id: Long): ProjectEntity?

    @Query("SELECT * FROM projects WHERE workspaceId = :workspaceId")
    suspend fun inWorkspace(workspaceId: Long): List<ProjectEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(row: ProjectEntity)

    @Query("DELETE FROM projects WHERE id = :id")
    suspend fun delete(id: Long)

    @Query("DELETE FROM projects WHERE id > 0")
    suspend fun deleteServerRows()
}

@Dao
interface TaskDao {
    @Query("SELECT * FROM tasks ORDER BY priorityIndex, id")
    fun observe(): Flow<List<TaskEntity>>

    @Query("SELECT * FROM tasks ORDER BY priorityIndex, id")
    suspend fun all(): List<TaskEntity>

    @Query("SELECT * FROM tasks WHERE id = :id")
    suspend fun get(id: Long): TaskEntity?

    @Query("SELECT * FROM tasks WHERE projectId = :projectId")
    suspend fun inProject(projectId: Long): List<TaskEntity>

    @Query("SELECT * FROM tasks WHERE workspaceId = :workspaceId")
    suspend fun inWorkspace(workspaceId: Long): List<TaskEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(row: TaskEntity)

    @Query("DELETE FROM tasks WHERE id = :id")
    suspend fun delete(id: Long)

    @Query("DELETE FROM tasks WHERE id > 0")
    suspend fun deleteServerRows()
}

@Dao
interface OutboxDao {
    @Query("SELECT * FROM outbox ORDER BY id")
    suspend fun all(): List<OutboxEntity>

    @Insert
    suspend fun insert(row: OutboxEntity): Long

    @Query("DELETE FROM outbox WHERE id = :id")
    suspend fun delete(id: Long)

    @Query("DELETE FROM outbox WHERE entityType = :entityType AND localId = :localId")
    suspend fun deleteFor(entityType: String, localId: Long)

    @Query("DELETE FROM outbox")
    suspend fun deleteAll()

    @Query(
        "UPDATE outbox SET path = :path, bodyJson = :body, localId = :localId, fieldsJson = :fields WHERE id = :id",
    )
    suspend fun updatePayload(id: Long, path: String, body: String?, localId: Long, fields: String)
}

@Dao
interface SyncStateDao {
    @Query("SELECT * FROM sync_state WHERE id = 1")
    fun observe(): Flow<SyncStateEntity?>

    @Query("SELECT * FROM sync_state WHERE id = 1")
    suspend fun get(): SyncStateEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(row: SyncStateEntity)
}

@Database(
    entities = [
        WorkspaceEntity::class,
        ProjectEntity::class,
        TaskEntity::class,
        OutboxEntity::class,
        SyncStateEntity::class,
    ],
    version = 1,
    exportSchema = false,
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun workspaces(): WorkspaceDao
    abstract fun projects(): ProjectDao
    abstract fun tasks(): TaskDao
    abstract fun outbox(): OutboxDao
    abstract fun syncState(): SyncStateDao

    companion object {
        @Volatile private var instance: AppDatabase? = null

        fun get(context: Context): AppDatabase {
            return instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "project-manager.db",
                ).build().also { instance = it }
            }
        }
    }
}
