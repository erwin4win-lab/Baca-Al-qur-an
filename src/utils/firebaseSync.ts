import {
  doc,
  getDoc,
  setDoc,
  collection,
  onSnapshot
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, User } from '../lib/firebase';
import { DayRecord, PrayerTime, UserSettings } from '../types/quran';
import { clampNumber, isValidDateString, sanitizeString } from './sanitize';
import { createInitialPrayers, getTodayDateString } from './storage';

const VALID_PLAN_IDS = new Set(['1x', '2x', '3x', 'custom']);

/**
 * Menyimpan atau memperbarui profil & pengaturan pengguna ke Firestore: /users/{userId}
 * Mempertahankan createdAt jika sudah ada dan memvalidasi seluruh field sesuai blueprint.
 */
export async function saveUserProfileToFirestore(
  user: User,
  settings: UserSettings,
  isNewUser = false
): Promise<void> {
  if (!user?.uid) return;
  const path = `users/${user.uid}`;
  try {
    const planId = VALID_PLAN_IDS.has(settings?.planId) ? settings.planId : '1x';
    const userPayload: Record<string, unknown> = {
      userId: user.uid,
      displayName: sanitizeString(settings?.userName || user.displayName || "Sahabat Qur'an", 100) || "Sahabat Qur'an",
      email: sanitizeString(user.email || '', 150),
      photoURL: sanitizeString(user.photoURL || '', 500),
      planId,
      customDays: clampNumber(settings?.customDays, 1, 365, 30),
      customTargetCount: clampNumber(settings?.customTargetCount, 1, 30, 1),
      lastReadPage: clampNumber(settings?.lastReadPage, 1, 604, 1),
      lastReadSurah: sanitizeString(settings?.lastReadSurah || 'Al-Baqarah', 50) || 'Al-Baqarah',
      lastReadAyat: clampNumber(settings?.lastReadAyat, 0, 300, 1),
      currentJuz: clampNumber(settings?.currentJuz, 1, 30, 1),
      soundEnabled: Boolean(settings?.soundEnabled),
      hapticEnabled: Boolean(settings?.hapticEnabled),
      startDate: isValidDateString(settings?.startDate)
        ? settings.startDate
        : getTodayDateString(),
      updatedAt: new Date().toISOString()
    };

    if (isNewUser) {
      userPayload.createdAt = new Date().toISOString();
    }

    await setDoc(doc(db, 'users', user.uid), userPayload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Memuat profil & pengaturan pengguna dari Firestore: /users/{userId}
 */
export async function loadUserProfileFromFirestore(
  userId: string
): Promise<Partial<UserSettings> | null> {
  if (!userId) return null;
  const path = `users/${userId}`;
  try {
    const snapshot = await getDoc(doc(db, 'users', userId));
    if (!snapshot.exists()) return null;

    const data = snapshot.data();
    const planId = VALID_PLAN_IDS.has(data.planId) ? data.planId : '1x';

    return {
      planId,
      customDays: clampNumber(data.customDays, 1, 365, 30),
      customTargetCount: clampNumber(data.customTargetCount, 1, 30, 1),
      lastReadPage: clampNumber(data.lastReadPage, 1, 604, 1),
      lastReadSurah: sanitizeString(data.lastReadSurah || 'Al-Baqarah', 50) || 'Al-Baqarah',
      lastReadAyat: clampNumber(data.lastReadAyat, 0, 300, 1),
      currentJuz: clampNumber(data.currentJuz, 1, 30, 1),
      soundEnabled: data.soundEnabled !== undefined ? Boolean(data.soundEnabled) : true,
      hapticEnabled: data.hapticEnabled !== undefined ? Boolean(data.hapticEnabled) : true,
      startDate: isValidDateString(data.startDate)
        ? data.startDate
        : getTodayDateString(),
      userName: sanitizeString(data.displayName, 40)
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Menyimpan catatan tilawah harian ke Firestore: /users/{userId}/records/{date}
 */
export async function saveDayRecordToFirestore(
  userId: string,
  record: DayRecord
): Promise<void> {
  if (!userId || !record?.date || !isValidDateString(record.date)) return;
  const path = `users/${userId}/records/${record.date}`;
  try {
    const safeTarget = clampNumber(record.targetPages, 1, 604, 20);
    const cleanPrayers = createInitialPrayers(safeTarget, false);

    if (record.prayers && typeof record.prayers === 'object') {
      (['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'] as PrayerTime[]).forEach((key) => {
        const p = record.prayers[key];
        if (p && typeof p === 'object') {
          cleanPrayers[key] = {
            ...cleanPrayers[key],
            targetPages: clampNumber(p.targetPages, 1, 100, cleanPrayers[key].targetPages),
            completedPages: clampNumber(p.completedPages, 0, 100, 0),
            isCompleted: Boolean(p.isCompleted),
            surahNote: p.surahNote ? sanitizeString(p.surahNote, 80) : undefined
          };
        }
      });
    }

    const cleanRecord = {
      userId,
      date: record.date,
      dayNumber: clampNumber(record.dayNumber, 0, 365, 1),
      targetPages: safeTarget,
      completedPages: clampNumber(record.completedPages, 0, 604, 0),
      debtCarriedOver: clampNumber(record.debtCarriedOver, 0, 604, 0),
      debtAdded: clampNumber(record.debtAdded, 0, 604, 0),
      prayers: cleanPrayers,
      notes: sanitizeString(record.notes || '', 500),
      updatedAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'users', userId, 'records', record.date), cleanRecord, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Real-time listener untuk seluruh catatan tilawah pengguna: /users/{userId}/records
 */
export function subscribeUserRecordsFromFirestore(
  userId: string,
  onUpdate: (records: Record<string, DayRecord>) => void
): () => void {
  if (!userId) return () => {};
  const path = `users/${userId}/records`;
  const recordsCol = collection(db, 'users', userId, 'records');

  return onSnapshot(
    recordsCol,
    (snapshot) => {
      try {
        const recordsMap: Record<string, DayRecord> = {};
        snapshot.forEach((d) => {
          const item = d.data() as Partial<DayRecord>;
          if (item?.date && isValidDateString(item.date)) {
            const targetPages = clampNumber(item.targetPages, 1, 604, 20);
            const fallbackPrayers = createInitialPrayers(targetPages, false);

            if (item.prayers && typeof item.prayers === 'object') {
              (['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'] as PrayerTime[]).forEach((key) => {
                const p = item.prayers?.[key];
                if (p && typeof p === 'object') {
                  fallbackPrayers[key] = {
                    ...fallbackPrayers[key],
                    targetPages: clampNumber(p.targetPages, 1, 100, fallbackPrayers[key].targetPages),
                    completedPages: clampNumber(p.completedPages, 0, 100, 0),
                    isCompleted: Boolean(p.isCompleted),
                    surahNote: p.surahNote ? sanitizeString(p.surahNote, 80) : undefined
                  };
                }
              });
            }

            recordsMap[item.date] = {
              date: item.date,
              dayNumber: clampNumber(item.dayNumber, 0, 365, 1),
              targetPages,
              completedPages: clampNumber(item.completedPages, 0, 604, 0),
              debtCarriedOver: clampNumber(item.debtCarriedOver, 0, 604, 0),
              debtAdded: clampNumber(item.debtAdded, 0, 604, 0),
              prayers: fallbackPrayers,
              notes: sanitizeString(item.notes || '', 500)
            };
          }
        });
        onUpdate(recordsMap);
      } catch (err) {
        console.error('Gagal memproses snapshot catatan Firestore:', err);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}
