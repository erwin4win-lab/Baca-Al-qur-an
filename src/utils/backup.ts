import { DayRecord, PrayerProgress, PrayerTime, UserSettings } from '../types/quran';
import { sanitizeString, clampNumber, isValidDateString, isSafeObjectKey } from './sanitize';
import { createInitialPrayers, DEFAULT_SETTINGS } from './storage';

const MAX_BACKUP_BYTES = 5 * 1024 * 1024; // 5 MB batas aman mencegah crash memori

export interface QuranBackupPayload {
  version: string;
  appName: string;
  exportedAt: string;
  summary: {
    totalRecords: number;
    totalPagesRead: number;
    khatamPlan: string;
    currentJuz: number;
    lastBookmark: string;
  };
  settings: UserSettings;
  records: Record<string, DayRecord>;
}

/**
 * Menghasilkan file JSON backup dan memicu unduhan otomatis di browser
 * dengan cleanup URL object yang aman.
 */
export function exportBackupData(
  settings: UserSettings,
  records: Record<string, DayRecord>
): { jsonString: string; filename: string } {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const filename = `backup-tilawah-quran-${dateStr}.json`;

  const totalPagesRead = Object.values(records || {}).reduce(
    (sum, r) => sum + clampNumber(r?.completedPages, 0, 1000, 0),
    0
  );

  const payload: QuranBackupPayload = {
    version: '1.1',
    appName: "Mutaba'ah Qur'an - Pelacak Progres Ramadhan",
    exportedAt: now.toISOString(),
    summary: {
      totalRecords: Object.keys(records || {}).length,
      totalPagesRead,
      khatamPlan: settings?.planId || '1x',
      currentJuz: clampNumber(settings?.currentJuz, 1, 30, 1),
      lastBookmark: `${sanitizeString(settings?.lastReadSurah || 'Al-Baqarah', 40)}: ${clampNumber(settings?.lastReadAyat, 1, 286, 1)} (Hal ${clampNumber(settings?.lastReadPage, 1, 604, 1)})`
    },
    settings,
    records
  };

  const jsonString = JSON.stringify(payload, null, 2);

  // Trigger browser download via Blob & schedule safe URL cleanup
  try {
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore cleanup error
      }
    }, 1000);
  } catch (err) {
    console.warn('Gagal memicu unduhan otomatis browser:', err);
  }

  return { jsonString, filename };
}

/**
 * Memvalidasi dan men-sanitasi penuh data UserSettings dari berkas impor.
 */
function sanitizeImportedSettings(raw: unknown): UserSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_SETTINGS };
  }

  const s = raw as Partial<UserSettings>;
  const validPlan = s.planId === '1x' || s.planId === '2x' || s.planId === '3x' || s.planId === 'custom'
    ? s.planId
    : DEFAULT_SETTINGS.planId;

  const reminderTimes = { ...DEFAULT_SETTINGS.reminderTimes };
  if (s.reminderTimes && typeof s.reminderTimes === 'object' && !Array.isArray(s.reminderTimes)) {
    (['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'] as PrayerTime[]).forEach((k) => {
      const val = (s.reminderTimes as Record<string, unknown>)[k];
      if (typeof val === 'string' && /^\d{2}:\d{2}$/.test(val)) {
        reminderTimes[k] = val;
      }
    });
  }

  return {
    planId: validPlan,
    customDays: clampNumber(s.customDays, 1, 365, DEFAULT_SETTINGS.customDays),
    customTargetCount: clampNumber(s.customTargetCount, 1, 30, DEFAULT_SETTINGS.customTargetCount),
    autoCarryOverDebt: typeof s.autoCarryOverDebt === 'boolean' ? s.autoCarryOverDebt : DEFAULT_SETTINGS.autoCarryOverDebt,
    remindersEnabled: typeof s.remindersEnabled === 'boolean' ? s.remindersEnabled : DEFAULT_SETTINGS.remindersEnabled,
    reminderTimes,
    soundEnabled: typeof s.soundEnabled === 'boolean' ? s.soundEnabled : DEFAULT_SETTINGS.soundEnabled,
    hapticEnabled: typeof s.hapticEnabled === 'boolean' ? s.hapticEnabled : DEFAULT_SETTINGS.hapticEnabled,
    mushafTotalPages: clampNumber(s.mushafTotalPages, 100, 1000, 604),
    currentJuz: clampNumber(s.currentJuz, 1, 30, 1),
    lastReadSurah: sanitizeString(s.lastReadSurah || 'Al-Baqarah', 50) || 'Al-Baqarah',
    lastReadAyat: clampNumber(s.lastReadAyat, 1, 286, 1),
    lastReadPage: clampNumber(s.lastReadPage, 1, 604, 1),
    startDate: isValidDateString(s.startDate) ? (s.startDate as string) : DEFAULT_SETTINGS.startDate,
    userName: s.userName ? sanitizeString(s.userName, 40) : undefined,
    userDivision: s.userDivision ? sanitizeString(s.userDivision, 50) : undefined
  };
}

/**
 * Memvalidasi dan men-sanitasi setiap DayRecord untuk mencegah data korup atau prototype pollution.
 */
function sanitizeImportedRecords(rawRecords: Record<string, unknown>): Record<string, DayRecord> {
  const cleanRecords: Record<string, DayRecord> = {};
  let dayIdx = 1;

  for (const [dateKey, rawVal] of Object.entries(rawRecords)) {
    if (!isSafeObjectKey(dateKey) || !isValidDateString(dateKey)) continue;
    if (!rawVal || typeof rawVal !== 'object' || Array.isArray(rawVal)) continue;

    const r = rawVal as Partial<DayRecord>;
    const targetPages = clampNumber(r.targetPages, 1, 500, 20);
    const prayers = createInitialPrayers(targetPages, false);

    if (r.prayers && typeof r.prayers === 'object' && !Array.isArray(r.prayers)) {
      (['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'] as PrayerTime[]).forEach((key) => {
        const pRaw = (r.prayers as Record<string, unknown>)[key];
        if (pRaw && typeof pRaw === 'object' && !Array.isArray(pRaw)) {
          const p = pRaw as Partial<PrayerProgress>;
          prayers[key] = {
            ...prayers[key],
            targetPages: clampNumber(p.targetPages, 1, 100, prayers[key].targetPages),
            completedPages: clampNumber(p.completedPages, 0, 100, 0),
            isCompleted: Boolean(p.isCompleted),
            surahNote: p.surahNote ? sanitizeString(p.surahNote, 80) : undefined,
            ayatNote: p.ayatNote ? sanitizeString(p.ayatNote, 40) : undefined
          };
        }
      });
    }

    cleanRecords[dateKey] = {
      date: dateKey,
      dayNumber: clampNumber(r.dayNumber, 1, 365, dayIdx++),
      targetPages,
      completedPages: clampNumber(r.completedPages, 0, 500, 0),
      debtCarriedOver: clampNumber(r.debtCarriedOver, 0, 500, 0),
      debtAdded: clampNumber(r.debtAdded, 0, 500, 0),
      prayers,
      notes: sanitizeString(r.notes || '', 500)
    };
  }

  return cleanRecords;
}

/**
 * Memvalidasi dan mem-parsing isi teks JSON impor dengan pemeriksaan skema yang ketat.
 */
export function parseAndValidateBackup(rawJson: string): {
  success: boolean;
  data?: QuranBackupPayload;
  error?: string;
} {
  if (!rawJson || typeof rawJson !== 'string') {
    return { success: false, error: 'Data JSON kosong atau tidak valid.' };
  }

  if (rawJson.length > MAX_BACKUP_BYTES) {
    return { success: false, error: 'Ukuran berkas terlalu besar (maksimal 5 MB).' };
  }

  try {
    const parsed = JSON.parse(rawJson);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { success: false, error: 'Format JSON bukan objek yang valid.' };
    }

    if (!parsed.records || typeof parsed.records !== 'object' || Array.isArray(parsed.records)) {
      return { success: false, error: 'File tidak memiliki data catatan tilawah (records).' };
    }

    const cleanRecords = sanitizeImportedRecords(parsed.records as Record<string, unknown>);
    const validDates = Object.keys(cleanRecords);
    if (validDates.length === 0) {
      return { success: false, error: 'Tidak ditemukan data tanggal yang valid di dalam berkas backup.' };
    }

    const cleanSettings = sanitizeImportedSettings(parsed.settings);
    const totalPagesRead = Object.values(cleanRecords).reduce(
      (sum, rec) => sum + rec.completedPages,
      0
    );

    const sanitizedPayload: QuranBackupPayload = {
      version: sanitizeString(parsed.version || '1.0', 20) || '1.0',
      appName: sanitizeString(parsed.appName || "Mutaba'ah Qur'an", 100) || "Mutaba'ah Qur'an",
      exportedAt: typeof parsed.exportedAt === 'string' && !Number.isNaN(Date.parse(parsed.exportedAt))
        ? parsed.exportedAt
        : new Date().toISOString(),
      summary: {
        totalRecords: validDates.length,
        totalPagesRead,
        khatamPlan: cleanSettings.planId,
        currentJuz: cleanSettings.currentJuz,
        lastBookmark: `${cleanSettings.lastReadSurah || 'Al-Baqarah'}: ${cleanSettings.lastReadAyat || 1} (Hal ${cleanSettings.lastReadPage})`
      },
      settings: cleanSettings,
      records: cleanRecords
    };

    return {
      success: true,
      data: sanitizedPayload
    };
  } catch (e: unknown) {
    const err = e as Error;
    return {
      success: false,
      error: `Gagal membaca format JSON: ${err?.message || 'Sintaks tidak valid'}`
    };
  }
}
