export interface ArchitectureCodeSnippet {
  fileName: string;
  language: 'kotlin' | 'dart' | 'sql';
  category: 'Entity' | 'DAO' | 'Database' | 'Repository' | 'ViewModel' | 'Flutter SQLite';
  description: string;
  code: string;
}

export const ANDROID_ROOM_EXPLANATION = {
  overview: `
Arsitektur database lokal untuk aplikasi **Al-Qur'an Progress Tracker** dirancang dengan prinsip **Clean Architecture & Offline-First** menggunakan **Room Database (SQLite Object Mapping)** pada Android Kotlin.

### Konsep Inti Data & Relasi:
1. **Tabel \`khatam_settings\`**: Menyimpan preferensi target khatam pengguna (1x, 2x, 3x, atau Custom), total halaman per hari, serta konfigurasi auto-rollover utang halaman.
2. **Tabel \`daily_progress\`**: Menyimpan catatan agregat harian (tanggal, hari ke-N Ramadhan, target halaman, realisasi halaman, status pencapaian, dan utang halaman terbawa).
3. **Tabel \`prayer_progress\`**: Menyimpan rincian progres per waktu shalat fardhu (Subuh, Dzuhur, Ashar, Maghrib, Isya) dengan relasi Foreign Key ke \`daily_progress\`.
4. **Logika Otomatis "Pelacak Utang" (Qadha Halaman)**:
   - Jika \`completed_pages < target_pages\` pada hari $T-1$, selisihnya dihitung sebagai \`debt_pages\`.
   - Melalui query Room DAO atau Repository, akumulasi utang ditambahkan ke target hari berjalan $T$ atau didistribusikan secara dinamis ke sisa hari yang tersisa.
  `,
  tables: [
    {
      name: 'daily_progress',
      description: 'Menyimpan riwayat tilawah harian dan akumulasi utang halaman.',
      columns: [
        { name: 'date', type: 'TEXT (PRIMARY KEY)', desc: 'Format YYYY-MM-DD (Indeks utama)' },
        { name: 'day_number', type: 'INTEGER', desc: 'Urutan hari ke-1 s/d 30' },
        { name: 'target_pages', type: 'INTEGER', desc: 'Target dasar hari ini (misal 20 halaman)' },
        { name: 'completed_pages', type: 'INTEGER', desc: 'Total halaman yang sudah dibaca hari ini' },
        { name: 'debt_carried_over', type: 'INTEGER', desc: 'Utang halaman dari hari sebelumnya yang harus dibayar' },
        { name: 'is_target_achieved', type: 'INTEGER (BOOLEAN)', desc: '1 jika selesai, 0 jika belum' },
        { name: 'notes', type: 'TEXT (NULLABLE)', desc: 'Catatan tadabbur atau surah terakhir' }
      ]
    },
    {
      name: 'prayer_progress',
      description: 'Menyimpan rincian checklist progres membaca untuk setiap 5 waktu shalat fardhu.',
      columns: [
        { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT', desc: 'ID unik per sesi shalat' },
        { name: 'date_ref', type: 'TEXT (FOREIGN KEY)', desc: 'Merujuk ke daily_progress.date (ON DELETE CASCADE)' },
        { name: 'prayer_name', type: 'TEXT', desc: 'SUBUH, DZUHUR, ASHAR, MAGHRIB, atau ISYA' },
        { name: 'target_pages', type: 'INTEGER', desc: 'Target per shalat (default: 4 halaman)' },
        { name: 'completed_pages', type: 'INTEGER', desc: 'Realisasi halaman yang dibaca usai shalat' },
        { name: 'is_completed', type: 'INTEGER (BOOLEAN)', desc: 'Status centang checklist shalat' },
        { name: 'surah_ayat_note', type: 'TEXT', desc: 'Surah & Ayat yang dibaca (cth: Al-Baqarah 1-25)' }
      ]
    },
    {
      name: 'user_khatam_plan',
      description: 'Konfigurasi rencana khatam yang dipilih pengguna.',
      columns: [
        { name: 'id', type: 'INTEGER PRIMARY KEY', desc: 'ID konstan tunggal = 1 (Single settings row)' },
        { name: 'plan_type', type: 'TEXT', desc: '"1X", "2X", "3X", "CUSTOM"' },
        { name: 'total_days', type: 'INTEGER', desc: 'Jumlah hari target (default: 30)' },
        { name: 'pages_per_day', type: 'INTEGER', desc: 'Target halaman harian (20, 40, atau 60)' },
        { name: 'auto_redistribute_debt', type: 'INTEGER (BOOLEAN)', desc: 'Otomatis bagi utang ke sisa hari' }
      ]
    }
  ]
};

export const KOTLIN_ROOM_CODE_SNIPPETS: ArchitectureCodeSnippet[] = [
  {
    fileName: 'DailyProgressEntity.kt',
    language: 'kotlin',
    category: 'Entity',
    description: 'Entitas Room Database untuk menyimpan data progres harian dan utang tilawah.',
    code: `package com.ramadhan.qurantracker.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Entitas Room untuk mencatat progres tilawah per tanggal kalender.
 * Menyimpan target harian, realisasi, serta kalkulasi utang halaman.
 */
@Entity(tableName = "daily_progress")
data class DailyProgressEntity(
    @PrimaryKey
    @ColumnInfo(name = "date")
    val date: String, // Format: "yyyy-MM-dd"

    @ColumnInfo(name = "day_number")
    val dayNumber: Int, // Hari ke-1 sampai ke-30 Ramadhan

    @ColumnInfo(name = "target_pages")
    val targetPages: Int = 20, // Default 1 Juz (20 halaman Mushaf Madinah)

    @ColumnInfo(name = "completed_pages")
    val completedPages: Int = 0, // Halaman yang berhasil diselesaikan

    @ColumnInfo(name = "debt_carried_over")
    val debtCarriedOver: Int = 0, // Utang halaman yang diwarisi dari hari sebelumnya

    @ColumnInfo(name = "is_target_achieved")
    val isTargetAchieved: Boolean = false,

    @ColumnInfo(name = "last_updated_timestamp")
    val lastUpdatedTimestamp: Long = System.currentTimeMillis()
) {
    // Properti kalkulasi: total target hari ini termasuk utang kemarin
    val totalTargetWithDebt: Int
        get() = targetPages + debtCarriedOver

    // Properti kalkulasi: sisa halaman yang belum dibaca hari ini
    val remainingPages: Int
        get() = (totalTargetWithDebt - completedPages).coerceAtLeast(0)

    // Persentase pencapaian hari ini (0 - 100%)
    val progressPercentage: Float
        get() = if (totalTargetWithDebt > 0) {
            (completedPages.toFloat() / totalTargetWithDebt.toFloat()).coerceIn(0f, 1f) * 100f
        } else 0f
}`
  },
  {
    fileName: 'PrayerProgressEntity.kt',
    language: 'kotlin',
    category: 'Entity',
    description: 'Entitas rincian progres tilawah setelah 5 waktu shalat fardhu (ForeignKey ke DailyProgressEntity).',
    code: `package com.ramadhan.qurantracker.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Entitas untuk menyimpan checklist pembagian waktu shalat fardhu:
 * Shubuh, Dzuhur, Ashar, Maghrib, dan Isya.
 */
@Entity(
    tableName = "prayer_progress",
    foreignKeys = [
        ForeignKey(
            entity = DailyProgressEntity::class,
            parentColumns = ["date"],
            childColumns = ["daily_date"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["daily_date", "prayer_type"], unique = true)]
)
data class PrayerProgressEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    @ColumnInfo(name = "daily_date")
    val dailyDate: String, // Merujuk ke DailyProgressEntity.date

    @ColumnInfo(name = "prayer_type")
    val prayerType: String, // "SHUBUH", "DZUHUR", "ASHAR", "MAGHRIB", "ISYA"

    @ColumnInfo(name = "target_pages")
    val targetPages: Int = 4, // 4 halaman x 5 waktu = 20 halaman (1 Juz)

    @ColumnInfo(name = "completed_pages")
    val completedPages: Int = 0,

    @ColumnInfo(name = "is_completed")
    val isCompleted: Boolean = false,

    @ColumnInfo(name = "surah_note")
    val surahNote: String? = null, // Contoh: "Al-Baqarah: 1-25"

    @ColumnInfo(name = "completed_at_timestamp")
    val completedAtTimestamp: Long? = null
)`
  },
  {
    fileName: 'QuranProgressDao.kt',
    language: 'kotlin',
    category: 'DAO',
    description: 'Data Access Object (DAO) dengan kueri kalkulasi otomatis sisa utang dan Flow reaktif.',
    code: `package com.ramadhan.qurantracker.data.local.dao

import androidx.room.*
import com.ramadhan.qurantracker.data.local.entity.DailyProgressEntity
import com.ramadhan.qurantracker.data.local.entity.PrayerProgressEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface QuranProgressDao {

    // Mengambil data harian berdasarkan tanggal secara reaktif (Flow)
    @Query("SELECT * FROM daily_progress WHERE date = :date LIMIT 1")
    fun getDailyProgressByDate(date: String): Flow<DailyProgressEntity?>

    // Mengambil semua riwayat 30 hari untuk kalender target khatam
    @Query("SELECT * FROM daily_progress ORDER BY date ASC")
    fun getAllProgressList(): Flow<List<DailyProgressEntity>>

    // Mengambil rincian 5 waktu shalat untuk tanggal tertentu
    @Query("SELECT * FROM prayer_progress WHERE daily_date = :date")
    fun getPrayersForDate(date: String): Flow<List<PrayerProgressEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdateDailyProgress(daily: DailyProgressEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdatePrayerProgress(prayer: PrayerProgressEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAllPrayers(prayers: List<PrayerProgressEntity>)

    /**
     * LOGIKA PELACAK UTANG HALAMAN:
     * Menghitung total kekurangan halaman dari hari-hari sebelumnya yang belum tercapai.
     * Jika target_pages > completed_pages, selisihnya menjadi utang (debt).
     */
    @Query("""
        SELECT COALESCE(SUM(CASE 
            WHEN (target_pages + debt_carried_over) > completed_pages 
            THEN ((target_pages + debt_carried_over) - completed_pages) 
            ELSE 0 
        END), 0) 
        FROM daily_progress 
        WHERE date < :currentDate
    """)
    suspend fun calculateTotalUnpaidDebtBefore(currentDate: String): Int

    // Pelunasan utang: mencatat penambahan halaman qadha
    @Query("""
        UPDATE daily_progress 
        SET completed_pages = completed_pages + :pagesPaid,
            is_target_achieved = (completed_pages + :pagesPaid) >= (target_pages + debt_carried_over)
        WHERE date = :date
    """)
    suspend fun payDebtForDate(date: String, pagesPaid: Int)
}`
  },
  {
    fileName: 'QuranTrackerDatabase.kt',
    language: 'kotlin',
    category: 'Database',
    description: 'Konfigurasi RoomDatabase singleton dengan inisialisasi default waktu shalat.',
    code: `package com.ramadhan.qurantracker.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.ramadhan.qurantracker.data.local.dao.QuranProgressDao
import com.ramadhan.qurantracker.data.local.entity.DailyProgressEntity
import com.ramadhan.qurantracker.data.local.entity.PrayerProgressEntity

@Database(
    entities = [
        DailyProgressEntity::class,
        PrayerProgressEntity::class
    ],
    version = 1,
    exportSchema = true
)
abstract class QuranTrackerDatabase : RoomDatabase() {

    abstract fun quranProgressDao(): QuranProgressDao

    companion object {
        @Volatile
        private var INSTANCE: QuranTrackerDatabase? = null

        fun getInstance(context: Context): QuranTrackerDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    QuranTrackerDatabase::class.java,
                    "quran_ramadhan_tracker.db"
                )
                .fallbackToDestructiveMigration()
                .build()
                INSTANCE = instance
                instance
            }
        }
    }
}`
  },
  {
    fileName: 'QuranProgressRepository.kt',
    language: 'kotlin',
    category: 'Repository',
    description: 'Repository mengelola logika bisnis: inisialisasi shalat, pelacakan utang otomatis, dan pembaruan checklist.',
    code: `package com.ramadhan.qurantracker.data.repository

import com.ramadhan.qurantracker.data.local.dao.QuranProgressDao
import com.ramadhan.qurantracker.data.local.entity.DailyProgressEntity
import com.ramadhan.qurantracker.data.local.entity.PrayerProgressEntity
import kotlinx.coroutines.flow.Flow
import java.time.LocalDate

class QuranProgressRepository(
    private val dao: QuranProgressDao
) {
    /**
     * Memastikan data hari ini sudah ada.
     * Jika baru berganti hari, hitung sisa utang halaman dari kemarin dan bawa ke hari ini.
     */
    suspend fun ensureTodayInitialized(todayDate: String, dayNumber: Int, targetPages: Int) {
        // 1. Cek apakah ada utang dari hari sebelumnya
        val totalUnpaidDebt = dao.calculateTotalUnpaidDebtBefore(todayDate)

        // 2. Siapkan data harian hari ini
        val todayEntity = DailyProgressEntity(
            date = todayDate,
            dayNumber = dayNumber,
            targetPages = targetPages,
            completedPages = 0,
            debtCarriedOver = totalUnpaidDebt,
            isTargetAchieved = false
        )
        dao.insertOrUpdateDailyProgress(todayEntity)

        // 3. Inisialisasi 5 waktu shalat fardhu dengan porsi rata (misal 4 hal per shalat)
        val pagesPerPrayer = targetPages / 5
        val prayers = listOf("SHUBUH", "DZUHUR", "ASHAR", "MAGHRIB", "ISYA").map { prayer ->
            PrayerProgressEntity(
                dailyDate = todayDate,
                prayerType = prayer,
                targetPages = pagesPerPrayer,
                completedPages = 0,
                isCompleted = false
            )
        }
        dao.insertAllPrayers(prayers)
    }

    /**
     * Memperbarui status centang shalat dan mengakumulasikan total halaman harian.
     */
    suspend fun updatePrayerStatus(
        prayer: PrayerProgressEntity,
        isCompleted: Boolean,
        completedPages: Int,
        surahNote: String?
    ) {
        val updatedPrayer = prayer.copy(
            isCompleted = isCompleted,
            completedPages = if (isCompleted && completedPages == 0) prayer.targetPages else completedPages,
            surahNote = surahNote,
            completedAtTimestamp = if (isCompleted) System.currentTimeMillis() else null
        )
        dao.insertOrUpdatePrayerProgress(updatedPrayer)
    }
}`
  },
  {
    fileName: 'OfficeLeaderboardRepository.kt',
    language: 'kotlin',
    category: 'Repository',
    description: 'Repository untuk sinkronisasi leaderboard grup kantor antar perangkat rekan kerja via Firestore/REST API.',
    code: `package com.ramadhan.qurantracker.data.repository

import com.ramadhan.qurantracker.data.local.dao.QuranProgressDao
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

data class OfficeColleagueDto(
    val id: String,
    val name: String,
    val division: String,
    val targetKhatam: Int,
    val totalPagesRead: Int,
    val totalTargetPages: Int,
    val todayCompletedPages: Int,
    val todayTargetPages: Int,
    val currentJuz: Int,
    val streakDays: Int,
    val duasReceived: Int
)

class OfficeLeaderboardRepository(
    private val dao: QuranProgressDao
) {
    /**
     * Mengunggah capaian tilawah pengguna saat ini ke grup kantor
     * agar rekan kantor lain dapat melihat progres terbaru di Leaderboard.
     */
    suspend fun syncMyProgressToOfficeCircle(
        circleCode: String,
        userId: String,
        userName: String,
        division: String,
        todayPages: Int,
        totalPages: Int,
        juz: Int,
        streak: Int
    ) {
        val payload = mapOf(
            "userId" to userId,
            "name" to userName,
            "division" to division,
            "todayCompletedPages" to todayPages,
            "totalPagesRead" to totalPages,
            "currentJuz" to juz,
            "streakDays" to streak,
            "lastUpdated" to System.currentTimeMillis()
        )
        // Kirim ke Firestore collection: "office_circles/{circleCode}/members/{userId}"
        // FirebaseFirestore.getInstance().document("office_circles/$circleCode/members/$userId").set(payload)
    }

    /**
     * Mengirimkan doa / apresiasi ukhuwah ("Barakallahu fiik") ke rekan kantor
     */
    suspend fun sendDuaToColleague(circleCode: String, targetUserId: String) {
        // FieldValue.increment(1) pada dokumen target di Firestore
    }
}`
  },
  {
    fileName: 'flutter_quran_sqlite_helper.dart',
    language: 'dart',
    category: 'Flutter SQLite',
    description: 'Alternatif implementasi SQLite di Flutter (sqflite) dengan pembagian shalat dan pelacak utang.',
    code: `import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

class QuranTrackerSqliteHelper {
  static final QuranTrackerSqliteHelper instance = QuranTrackerSqliteHelper._init();
  static Database? _database;

  QuranTrackerSqliteHelper._init();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB('quran_ramadhan_tracker.db');
    return _database!;
  }

  Future<Database> _initDB(String filePath) async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, filePath);

    return await openDatabase(
      path,
      version: 1,
      onCreate: _createDB,
    );
  }

  Future _createDB(Database db, int version) async {
    // 1. Tabel Progres Harian Al-Qur'an
    await db.execute('''
      CREATE TABLE daily_progress (
        date TEXT PRIMARY KEY,
        day_number INTEGER NOT NULL,
        target_pages INTEGER NOT NULL DEFAULT 20,
        completed_pages INTEGER NOT NULL DEFAULT 0,
        debt_carried_over INTEGER NOT NULL DEFAULT 0,
        is_target_achieved INTEGER NOT NULL DEFAULT 0
      )
    ''');

    // 2. Tabel Checklist 5 Waktu Shalat
    await db.execute('''
      CREATE TABLE prayer_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        daily_date TEXT NOT NULL,
        prayer_type TEXT NOT NULL,
        target_pages INTEGER NOT NULL DEFAULT 4,
        completed_pages INTEGER NOT NULL DEFAULT 0,
        is_completed INTEGER NOT NULL DEFAULT 0,
        surah_note TEXT,
        FOREIGN KEY (daily_date) REFERENCES daily_progress (date) ON DELETE CASCADE
      )
    ''');
  }

  /// Menghitung akumulasi utang halaman yang belum dibayar dari hari sebelumnya
  Future<int> calculateAccumulatedDebt(String currentDate) async {
    final db = await instance.database;
    final result = await db.rawQuery('''
      SELECT SUM(CASE 
        WHEN (target_pages + debt_carried_over) > completed_pages 
        THEN ((target_pages + debt_carried_over) - completed_pages) 
        ELSE 0 
      END) as total_debt
      FROM daily_progress
      WHERE date < ?
    ''', [currentDate]);

    final debt = result.first['total_debt'];
    return (debt != null) ? (debt as int) : 0;
  }
}`
  }
];
