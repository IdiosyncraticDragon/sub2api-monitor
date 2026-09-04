package com.sub2api.watchdog.data

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import com.google.gson.Gson
import com.sub2api.watchdog.core.WatchdogSnapshot
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

@Entity(tableName = "watchdog_snapshot") data class SnapshotEntity(val id: Int = 1, val payload: String, val updatedAt: Long)
@Dao interface SnapshotDao { @Query("SELECT * FROM watchdog_snapshot WHERE id = 1") fun observe(): Flow<SnapshotEntity?>; @Query("SELECT * FROM watchdog_snapshot WHERE id = 1") suspend fun get(): SnapshotEntity?; @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun save(value: SnapshotEntity); @Query("DELETE FROM watchdog_snapshot") suspend fun clear() }
@Database(entities = [SnapshotEntity::class], version = 1, exportSchema = false) abstract class WatchdogDatabase : RoomDatabase() { abstract fun snapshots(): SnapshotDao }
class SnapshotStore(private val dao: SnapshotDao, private val gson: Gson = Gson()) {
    val snapshots: Flow<WatchdogSnapshot> = dao.observe().map { it?.let { entity -> gson.fromJson(entity.payload, WatchdogSnapshot::class.java) } ?: WatchdogSnapshot() }
    suspend fun save(value: WatchdogSnapshot) = dao.save(SnapshotEntity(payload = gson.toJson(value), updatedAt = value.updatedAt))
    suspend fun clear() = dao.clear()
}
fun createDatabase(context: Context): WatchdogDatabase = Room.databaseBuilder(context, WatchdogDatabase::class.java, "watchdog.db").build()
