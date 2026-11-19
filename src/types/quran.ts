export type PrayerTime = 'subuh' | 'dzuhur' | 'ashar' | 'maghrib' | 'isya';

export interface PrayerProgress {
  prayer: PrayerTime;
  name: string;
  arabicName: string;
  targetPages: number;
  completedPages: number;
  isCompleted: boolean;
  surahNote?: string;
  ayatNote?: string;
  completedAt?: string;
}

export interface DayRecord {
  date: string; // YYYY-MM-DD
  dayNumber: number; // 1 - 30 of Ramadhan/preparation
  targetPages: number;
  completedPages: number;
  debtCarriedOver: number; // Utang yang dibawa dari hari sebelumnya
  debtAdded: number; // Utang baru jika hari ini kurang
  prayers: Record<PrayerTime, PrayerProgress>;
  notes?: string;
}

export interface KhatamPlan {
  id: '1x' | '2x' | '3x' | 'custom';
  title: string;
  targetCount: number; // berapa kali khatam (1, 2, 3)
  totalDays: number; // biasanya 30 hari Ramadhan
  pagesPerDay: number; // misal 20, 40, 60
  pagesPerPrayer: number; // misal 4, 8, 12
  description: string;
}

export interface IslamicQuote {
  id: number;
  arabic: string;
  translation: string;
  source: string;
  theme: 'ikhlas' | 'keutamaan' | 'istiqomah' | 'tadabbur';
  reflection: string;
}

export interface SurahInfo {
  number: number;
  name: string;
  arabicName: string;
  totalVerses: number;
  revelation: 'Makkiyah' | 'Madaniyah';
  startPage: number;
  juz: number;
}

export interface UserSettings {
  planId: '1x' | '2x' | '3x' | 'custom';
  customDays: number;
  customTargetCount: number;
  autoCarryOverDebt: boolean;
  remindersEnabled: boolean;
  reminderTimes: Record<PrayerTime, string>;
  soundEnabled: boolean;
  hapticEnabled: boolean;
  mushafTotalPages: number; // default 604 standar Madinah
  currentJuz: number;
  lastReadSurah?: string;
  lastReadAyat?: number;
  lastReadPage: number;
  startDate: string; // ISO date when tracking starts
  userName?: string;
  userDivision?: string;
}

export interface OfficeColleague {
  id: string;
  name: string;
  division: string; // cth: "IT & Tech", "Finance & Accounting", "Marketing", "HR & People", "Operations"
  avatarColor: string; // Tailwind color class or hex
  targetKhatam: number; // 1x, 2x, 3x
  totalPagesRead: number;
  totalTargetPages: number;
  todayCompletedPages: number;
  todayTargetPages: number;
  currentJuz: number;
  currentSurah: string;
  streakDays: number;
  lastActive: string; // cth: "10 menit lalu usai Dzuhur"
  duasReceived: number;
  isCurrentUser?: boolean;
}

export interface OfficeCircleGroup {
  id: string;
  code: string; // cth: "KANTOR-RAMADHAN"
  name: string; // cth: "Keluarga Besar Kantor - Ramadhan 1446H"
  targetKhatamGroup: number; // cth: 10x khatam bersama
  members: OfficeColleague[];
}
