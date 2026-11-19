import { DayRecord, PrayerProgress, PrayerTime, UserSettings } from '../types/quran';
import { KHATAM_PLANS } from '../data/surahData';
import {
  clampNumber,
  isSafeObjectKey,
  isValidDateString,
  sanitizeString,
  shiftLocalDateString
} from './sanitize';

const SETTINGS_KEY = 'mutabaah_quran_settings';
const RECORDS_KEY = 'mutabaah_quran_records';

export const DEFAULT_SETTINGS: UserSettings = {
  planId: '1x',
  customDays: 30,
  customTargetCount: 1,
  autoCarryOverDebt: true,
  remindersEnabled: true,
  reminderTimes: {
    subuh: '05:00',
    dzuhur: '12:30',
    ashar: '15:45',
    maghrib: '18:25',
    isya: '19:45'
  },
  soundEnabled: true,
  hapticEnabled: true,
  mushafTotalPages: 604,
  currentJuz: 1,
  lastReadSurah: 'Al-Baqarah',
  lastReadAyat: 141,
  lastReadPage: 21,
  startDate: getTodayDateString()
};

export const PRAYER_METADATA: { key: PrayerTime; name: string; arabicName: string; defaultTime: string }[] = [
  { key: 'subuh', name: 'Shubuh', arabicName: 'الصُّبْح', defaultTime: '05:00' },
  { key: 'dzuhur', name: 'Dzuhur', arabicName: 'الظُّهْر', defaultTime: '12:30' },
  { key: 'ashar', name: 'Ashar', arabicName: 'العَصْر', defaultTime: '15:45' },
  { key: 'maghrib', name: 'Maghrib', arabicName: 'المَغْرِب', defaultTime: '18:25' },
  { key: 'isya', name: 'Isya', arabicName: 'العِشَاء', defaultTime: '19:45' }
];

export function getTodayDateString(): string {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '2026-10-27';
  }
}

export function createInitialPrayers(targetPages: number, completedDefaults: boolean = false): Record<PrayerTime, PrayerProgress> {
  const safeTarget = clampNumber(targetPages, 1, 300, 20);
  const pagesPerPrayer = Math.floor(safeTarget / 5);
  const remainder = safeTarget % 5;

  const result: Partial<Record<PrayerTime, PrayerProgress>> = {};
  PRAYER_METADATA.forEach((meta, idx) => {
    const target = pagesPerPrayer + (idx < remainder ? 1 : 0);
    result[meta.key] = {
      prayer: meta.key,
      name: meta.name,
      arabicName: meta.arabicName,
      targetPages: target,
      completedPages: completedDefaults ? target : 0,
      isCompleted: completedDefaults,
      surahNote: meta.key === 'subuh' ? 'Al-Baqarah 1-25' : undefined
    };
  });
  return result as Record<PrayerTime, PrayerProgress>;
}

function cloneDefaultSettings(): UserSettings {
  return {
    ...DEFAULT_SETTINGS,
    startDate: getTodayDateString(),
    reminderTimes: { ...DEFAULT_SETTINGS.reminderTimes }
  };
}

function isValidTimeHHMM(val: unknown): val is string {
  return typeof val === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(val);
}

/**
 * Memuat pengaturan pengguna dengan penanganan error komprehensif & fallback sanitization
 */
export function loadSettings(): UserSettings {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return cloneDefaultSettings();
    }
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return cloneDefaultSettings();

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return cloneDefaultSettings();
    }

    const reminderTimes = { ...DEFAULT_SETTINGS.reminderTimes };
    if (parsed.reminderTimes && typeof parsed.reminderTimes === 'object') {
      (['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'] as PrayerTime[]).forEach((key) => {
        const candidate = parsed.reminderTimes[key];
        if (isValidTimeHHMM(candidate)) {
          reminderTimes[key] = candidate;
        }
      });
    }

    return {
      planId: ['1x', '2x', '3x', 'custom'].includes(parsed.planId) ? parsed.planId : '1x',
      customDays: clampNumber(parsed.customDays, 1, 365, 30),
      customTargetCount: clampNumber(parsed.customTargetCount, 1, 10, 1),
      autoCarryOverDebt: typeof parsed.autoCarryOverDebt === 'boolean' ? parsed.autoCarryOverDebt : true,
      remindersEnabled: typeof parsed.remindersEnabled === 'boolean' ? parsed.remindersEnabled : true,
      reminderTimes,
      soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
      hapticEnabled: typeof parsed.hapticEnabled === 'boolean' ? parsed.hapticEnabled : true,
      mushafTotalPages: clampNumber(parsed.mushafTotalPages, 100, 1000, 604),
      currentJuz: clampNumber(parsed.currentJuz, 1, 30, 1),
      lastReadSurah: sanitizeString(parsed.lastReadSurah, 50) || 'Al-Baqarah',
      lastReadAyat: clampNumber(parsed.lastReadAyat, 1, 286, 1),
      lastReadPage: clampNumber(parsed.lastReadPage, 1, 604, 21),
      startDate: isValidDateString(parsed.startDate) ? parsed.startDate : getTodayDateString(),
      userName: parsed.userName ? sanitizeString(parsed.userName, 40) : undefined
    };
  } catch (error) {
    console.warn('Gagal memuat pengaturan lokal, menggunakan pengaturan bawaan:', error);
    return cloneDefaultSettings();
  }
}

/**
 * Menyimpan pengaturan dengan penanganan QuotaExceededError
 */
export function saveSettings(settings: UserSettings): boolean {
  try {
    if (!settings || typeof settings !== 'object') return false;
    if (typeof window === 'undefined' || !window.localStorage) return false;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error('Peringatan: Gagal menyimpan pengaturan ke localStorage (mungkin kuota penuh):', error);
    return false;
  }
}

/**
 * Memvalidasi dan memastikan struktur Record harian lengkap tanpa celah properti undefined
 */
function sanitizeDayRecord(raw: unknown, defaultDate: string, defaultDayNum: number): DayRecord {
  const baseTarget = 20;
  if (!raw || typeof raw !== 'object') {
    return {
      date: defaultDate,
      dayNumber: defaultDayNum,
      targetPages: baseTarget,
      completedPages: 0,
      debtCarriedOver: 0,
      debtAdded: 0,
      prayers: createInitialPrayers(baseTarget, false),
      notes: ''
    };
  }

  const r = raw as Partial<DayRecord>;
  const date = isValidDateString(r.date) ? (r.date as string) : defaultDate;
  const dayNumber = clampNumber(r.dayNumber, 1, 365, defaultDayNum);
  const targetPages = clampNumber(r.targetPages, 1, 500, baseTarget);
  const completedPages = clampNumber(r.completedPages, 0, 500, 0);
  const debtCarriedOver = clampNumber(r.debtCarriedOver, 0, 500, 0);
  const debtAdded = clampNumber(r.debtAdded, 0, 500, 0);

  // Pastikan 5 waktu shalat selalu terisi lengkap
  const prayers = createInitialPrayers(targetPages, false);
  if (r.prayers && typeof r.prayers === 'object') {
    (['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'] as PrayerTime[]).forEach((key) => {
      const p = (r.prayers as Record<PrayerTime, unknown>)[key];
      if (p && typeof p === 'object') {
        const rawP = p as Partial<PrayerProgress>;
        prayers[key] = {
          ...prayers[key],
          targetPages: clampNumber(rawP.targetPages, 1, 100, prayers[key].targetPages),
          completedPages: clampNumber(rawP.completedPages, 0, 100, 0),
          isCompleted: Boolean(rawP.isCompleted),
          surahNote: typeof rawP.surahNote === 'string' ? rawP.surahNote : undefined
        };
      }
    });
  }

  return {
    date,
    dayNumber,
    targetPages,
    completedPages,
    debtCarriedOver,
    debtAdded,
    prayers,
    notes: typeof r.notes === 'string' ? r.notes : ''
  };
}

/**
 * Memuat semua catatan harian dengan validasi integritas data
 */
export function loadAllRecords(): Record<string, DayRecord> {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return generateSeedRecords();
    }
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) {
      const seeded = generateSeedRecords();
      saveAllRecords(seeded);
      return seeded;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      const seeded = generateSeedRecords();
      saveAllRecords(seeded);
      return seeded;
    }

    // Sanitasi setiap hari agar tidak ada objek rusak atau prototype pollution
    const sanitized: Record<string, DayRecord> = {};
    let dayIdx = 1;
    for (const [dateKey, dayData] of Object.entries(parsed)) {
      if (isSafeObjectKey(dateKey) && isValidDateString(dateKey)) {
        sanitized[dateKey] = sanitizeDayRecord(dayData, dateKey, dayIdx++);
      }
    }

    if (Object.keys(sanitized).length === 0) {
      const seeded = generateSeedRecords();
      saveAllRecords(seeded);
      return seeded;
    }

    return sanitized;
  } catch (error) {
    console.warn('Gagal membaca data rekaman dari storage, memulihkan data bawaan:', error);
    const seeded = generateSeedRecords();
    saveAllRecords(seeded);
    return seeded;
  }
}

/**
 * Menyimpan seluruh catatan harian dengan proteksi QuotaExceededError
 */
export function saveAllRecords(records: Record<string, DayRecord>): boolean {
  try {
    if (!records || typeof records !== 'object') return false;
    if (typeof window === 'undefined' || !window.localStorage) return false;
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
    return true;
  } catch (error) {
    console.error('Error saat menyimpan catatan ke localStorage:', error);
    return false;
  }
}

export function generateSeedRecords(): Record<string, DayRecord> {
  const records: Record<string, DayRecord> = {};
  const todayStr = getTodayDateString();
  const currentDayIndex = 5;

  for (let i = 1; i <= 30; i++) {
    const offset = i - currentDayIndex;
    const dateStr = shiftLocalDateString(todayStr, offset);

    const targetPages = 20;

    if (i < 4) {
      const prayers = createInitialPrayers(targetPages, true);
      records[dateStr] = {
        date: dateStr,
        dayNumber: i,
        targetPages,
        completedPages: targetPages,
        debtCarriedOver: 0,
        debtAdded: 0,
        prayers,
        notes: `Alhamdulillah hari ke-${i} khatam 1 Juz.`
      };
    } else if (i === 4) {
      const prayers = createInitialPrayers(targetPages, false);
      prayers.subuh.isCompleted = true;
      prayers.subuh.completedPages = 4;
      prayers.dzuhur.isCompleted = true;
      prayers.dzuhur.completedPages = 4;
      prayers.ashar.isCompleted = true;
      prayers.ashar.completedPages = 4;
      prayers.maghrib.isCompleted = true;
      prayers.maghrib.completedPages = 2;
      prayers.isya.isCompleted = false;
      prayers.isya.completedPages = 0;

      records[dateStr] = {
        date: dateStr,
        dayNumber: i,
        targetPages,
        completedPages: 14,
        debtCarriedOver: 0,
        debtAdded: 6,
        prayers,
        notes: 'Kemarin ada agenda mendadak, sisa 6 halaman terbawa ke hari ini.'
      };
    } else if (i === 5) {
      const prayers = createInitialPrayers(targetPages, false);
      prayers.subuh.isCompleted = true;
      prayers.subuh.completedPages = 4;
      prayers.subuh.surahNote = 'Al-Baqarah 1-25';
      prayers.dzuhur.isCompleted = true;
      prayers.dzuhur.completedPages = 4;
      prayers.dzuhur.surahNote = 'Al-Baqarah 26-50';

      records[dateStr] = {
        date: dateStr,
        dayNumber: i,
        targetPages,
        completedPages: 8,
        debtCarriedOver: 6,
        debtAdded: 0,
        prayers,
        notes: 'Semangat melunasi utang 6 halaman kemarin!'
      };
    } else {
      records[dateStr] = {
        date: dateStr,
        dayNumber: i,
        targetPages,
        completedPages: 0,
        debtCarriedOver: 0,
        debtAdded: 0,
        prayers: createInitialPrayers(targetPages, false),
        notes: ''
      };
    }
  }

  return records;
}

/**
 * Menghitung akumulasi utang halaman yang belum terbayar secara aman
 */
export function calculateAccumulatedDebt(records: Record<string, DayRecord>, currentDate: string): number {
  if (!records || typeof records !== 'object') return 0;
  let totalDebt = 0;

  try {
    const sortedDates = Object.keys(records).sort();
    for (const date of sortedDates) {
      if (date < currentDate) {
        const rec = records[date];
        if (rec) {
          const targetWithDebt = clampNumber(rec.targetPages, 0, 500, 20) + clampNumber(rec.debtCarriedOver, 0, 500, 0);
          const completed = clampNumber(rec.completedPages, 0, 500, 0);
          const missed = targetWithDebt - completed;
          if (missed > 0) {
            totalDebt += missed;
          }
        }
      }
    }
  } catch (err) {
    console.error('Error saat kalkulasi utang:', err);
  }
  return Math.max(0, totalDebt);
}

/**
 * Menghitung statistik keseluruhan dengan proteksi division-by-zero
 */
export function calculateOverallStats(records: Record<string, DayRecord>, settings: UserSettings) {
  const plan = KHATAM_PLANS[settings?.planId] || KHATAM_PLANS['1x'];
  const safeMushafTotal = clampNumber(settings?.mushafTotalPages, 100, 1000, 604);
  const targetCount = settings?.planId === 'custom'
    ? clampNumber(settings?.customTargetCount, 1, 10, 1)
    : clampNumber(plan.count, 1, 10, 1);

  const totalTargetPages = Math.max(1, safeMushafTotal * targetCount);

  let totalPagesRead = 0;
  let totalCompletedDays = 0;
  let maxStreak = 0;
  let tempStreak = 0;

  if (records && typeof records === 'object') {
    const dates = Object.keys(records).sort();
    for (const date of dates) {
      const rec = records[date];
      if (!rec) continue;

      const completed = clampNumber(rec.completedPages, 0, 1000, 0);
      const target = clampNumber(rec.targetPages, 1, 1000, 20);

      totalPagesRead += completed;

      if (completed >= target && target > 0) {
        totalCompletedDays++;
        tempStreak++;
        if (tempStreak > maxStreak) maxStreak = tempStreak;
      } else if (completed > 0) {
        tempStreak++;
      } else {
        tempStreak = 0;
      }
    }
  }

  const currentStreak = tempStreak;
  const currentJuz = Math.min(30, Math.max(1, Math.floor((totalPagesRead % 604) / 20) + 1));
  const khatamCompletion = Math.min(100, Math.max(0, Math.round((totalPagesRead / totalTargetPages) * 100)));

  return {
    totalPagesRead,
    totalTargetPages,
    totalCompletedDays,
    currentStreak,
    maxStreak,
    currentJuz,
    khatamCompletion
  };
}
