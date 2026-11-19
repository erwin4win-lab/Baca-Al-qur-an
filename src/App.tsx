import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  loadAllRecords,
  saveAllRecords,
  loadSettings,
  saveSettings,
  getTodayDateString,
  calculateAccumulatedDebt,
  calculateOverallStats,
  createInitialPrayers
} from './utils/storage';
import { DayRecord, PrayerTime, UserSettings } from './types/quran';
import { KHATAM_PLANS } from './data/surahData';
import { Header } from './components/Header';
import { DailyDashboard } from './components/DailyDashboard';
import { PrayerChecklist } from './components/PrayerChecklist';
import { WeeklyTrendChart } from './components/WeeklyTrendChart';
import { KhatamCalendar } from './components/KhatamCalendar';
import { DebtTrackerModal } from './components/DebtTrackerModal';
import { MotivationCard } from './components/MotivationCard';
import { AndroidArchitectureView } from './components/AndroidArchitectureView';
import { SurahBookmarkModal } from './components/SurahBookmarkModal';
import { NotificationSettingsModal } from './components/NotificationSettingsModal';
import { TilawahReceiptReport } from './components/TilawahReceiptReport';
import { BackupModal } from './components/BackupModal';
import { MushafMadinahReader } from './components/MushafMadinahReader';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  testConnection,
  User
} from './lib/firebase';
import {
  saveUserProfileToFirestore,
  loadUserProfileFromFirestore,
  saveDayRecordToFirestore,
  subscribeUserRecordsFromFirestore
} from './utils/firebaseSync';
import {
  BookOpen,
  Calendar,
  Printer,
  CheckCircle2,
  MoreHorizontal,
  X,
  AlertCircle,
  Sparkles,
  Database,
  HardDrive,
  Bell,
  Smartphone,
  Monitor,
  Wifi,
  Battery,
  Home,
  Flame,
  ArrowRight
} from 'lucide-react';
import { clampNumber, sanitizeString, shiftLocalDateString } from './utils/sanitize';
import { soundManager } from './utils/audioNotification';

export default function App() {
  const [settings, setSettings] = useState<UserSettings>(() => loadSettings());
  const [records, setRecords] = useState<Record<string, DayRecord>>(() => loadAllRecords());
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayDateString());
  const [activeTab, setActiveTab] = useState<'tracker' | 'mushaf' | 'calendar' | 'debt' | 'motivation' | 'report' | 'architecture'>('tracker');
  const [mushafActivePage, setMushafActivePage] = useState<number>(() => settings?.lastReadPage || 1);
  const [isMobileDeviceView, setIsMobileDeviceView] = useState<boolean>(false);
  const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isMobileMoreMenuOpen, setIsMobileMoreMenuOpen] = useState(false);
  const [duaNotification, setDuaNotification] = useState<string | null>(null);

  // Firebase Auth & Cloud Sync States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Timer & sync deduplication refs for cleanup & preventing write storms
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsRef = useRef<UserSettings>(settings);
  settingsRef.current = settings;
  const lastSyncedSettingsRef = useRef<string>('');
  const lastSyncedRecordsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      soundManager.dispose();
    };
  }, []);

  const showToast = (message: string, durationMs = 3500) => {
    setDuaNotification(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setDuaNotification(null), durationMs);
  };

  // Firebase Boot Connection Test & Auth State Listener
  useEffect(() => {
    testConnection();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          setIsSyncing(true);
          const cloudSettings = await loadUserProfileFromFirestore(user.uid);
          if (cloudSettings) {
            setSettings((prev) => {
              const merged = { ...prev, ...cloudSettings };
              lastSyncedSettingsRef.current = JSON.stringify(merged);
              return merged;
            });
          } else {
            await saveUserProfileToFirestore(user, settingsRef.current, true);
            lastSyncedSettingsRef.current = JSON.stringify(settingsRef.current);
          }
        } catch (err) {
          console.warn('Initial cloud sync notice:', err);
        } finally {
          setIsSyncing(false);
        }
      } else {
        lastSyncedSettingsRef.current = '';
        lastSyncedRecordsRef.current = {};
      }
    });

    return () => unsubscribe();
  }, []);

  // Real-time Firestore Listeners when User is Authenticated
  useEffect(() => {
    if (!currentUser?.uid) return;

    const unsubRecords = subscribeUserRecordsFromFirestore(currentUser.uid, (cloudRecords) => {
      Object.entries(cloudRecords).forEach(([dateKey, rec]) => {
        lastSyncedRecordsRef.current[dateKey] = JSON.stringify(rec);
      });
      setRecords((prev) => ({
        ...prev,
        ...cloudRecords
      }));
    });

    return () => {
      unsubRecords();
    };
  }, [currentUser?.uid]);

  // Sync settings to localStorage and deduplicated sync to Firestore
  useEffect(() => {
    try {
      saveSettings(settings);
    } catch (e) {
      console.warn('Gagal sinkronisasi pengaturan ke localStorage:', e);
    }

    if (currentUser?.uid) {
      const serialized = JSON.stringify(settings);
      if (serialized !== lastSyncedSettingsRef.current) {
        lastSyncedSettingsRef.current = serialized;
        saveUserProfileToFirestore(currentUser, settings, false).catch((e) =>
          console.warn('Error saving settings to cloud:', e)
        );
      }
    }
  }, [settings, currentUser]);

  useEffect(() => {
    try {
      saveAllRecords(records);
    } catch (e) {
      console.warn('Gagal sinkronisasi catatan harian ke localStorage:', e);
    }
  }, [records]);

  // Ensure record for selected date exists safely
  const storedRecordForDate = records[selectedDate];
  const currentRecord: DayRecord = storedRecordForDate || {
    date: selectedDate,
    dayNumber: 1,
    targetPages: KHATAM_PLANS[settings?.planId]?.pagesPerDay || 20,
    completedPages: 0,
    debtCarriedOver: 0,
    debtAdded: 0,
    prayers: createInitialPrayers(KHATAM_PLANS[settings?.planId]?.pagesPerDay || 20, false),
    notes: ''
  };

  const totalDebt = calculateAccumulatedDebt(records, selectedDate);
  const overallStats = calculateOverallStats(records, settings);

  // Auto-sync current record to Firestore ONLY when a persisted record changes
  useEffect(() => {
    if (!currentUser?.uid || !storedRecordForDate?.date) return;
    const serialized = JSON.stringify(storedRecordForDate);
    if (serialized === lastSyncedRecordsRef.current[storedRecordForDate.date]) return;

    lastSyncedRecordsRef.current[storedRecordForDate.date] = serialized;
    saveDayRecordToFirestore(currentUser.uid, storedRecordForDate).catch((err) =>
      console.warn('Error saving record to Firestore:', err)
    );
  }, [currentUser?.uid, storedRecordForDate]);

  // Safe celebration confetti
  const triggerCelebration = () => {
    try {
      if (typeof window !== 'undefined') {
        confetti({
          particleCount: 75,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#10b981', '#f59e0b', '#34d399', '#fbbf24']
        });
      }
    } catch {
      // Ignored if canvas or WebGL unavailable
    }
  };

  // Prayer update handler with try-catch and value clamping
  const handleUpdatePrayer = (
    prayerKey: PrayerTime,
    isCompleted: boolean,
    pages: number,
    surahNote?: string
  ) => {
    try {
      const safePages = clampNumber(pages, 0, 100, 0);
      const cleanNote = surahNote !== undefined ? sanitizeString(surahNote, 80) : undefined;
      const basePrayers = {
        ...createInitialPrayers(currentRecord.targetPages, false),
        ...(currentRecord.prayers || {})
      };

      const updatedPrayers = {
        ...basePrayers,
        [prayerKey]: {
          ...basePrayers[prayerKey],
          isCompleted,
          completedPages: safePages,
          surahNote: cleanNote !== undefined ? (cleanNote || undefined) : basePrayers[prayerKey]?.surahNote
        }
      };

      const totalDayCompleted = Object.values(updatedPrayers).reduce(
        (sum, p) => sum + clampNumber(p?.completedPages, 0, 100, 0),
        0
      );

      const targetWithDebt =
        clampNumber(currentRecord.targetPages, 0, 500, 20) +
        clampNumber(currentRecord.debtCarriedOver, 0, 500, 0);
      const wasAlreadyCompleted = currentRecord.completedPages >= targetWithDebt && targetWithDebt > 0;
      const nowCompleted = totalDayCompleted >= targetWithDebt && targetWithDebt > 0;

      if (!wasAlreadyCompleted && nowCompleted) {
        triggerCelebration();
      }

      const updatedRecord: DayRecord = {
        ...currentRecord,
        completedPages: totalDayCompleted,
        prayers: updatedPrayers
      };

      setRecords((prev) => ({
        ...prev,
        [selectedDate]: updatedRecord
      }));
    } catch (err) {
      console.error('Error saat memperbarui progres shalat:', err);
    }
  };

  // Mark all 5 prayers completed
  const handleQuickCompleteAll = () => {
    try {
      const updatedPrayers = {
        ...createInitialPrayers(currentRecord.targetPages, false),
        ...(currentRecord.prayers || {})
      };
      (Object.keys(updatedPrayers) as PrayerTime[]).forEach((key) => {
        const p = updatedPrayers[key];
        if (p) {
          updatedPrayers[key] = {
            ...p,
            isCompleted: true,
            completedPages: clampNumber(p.targetPages, 1, 100, 4)
          };
        }
      });

      const totalDayCompleted = Object.values(updatedPrayers).reduce(
        (sum, p) => sum + clampNumber(p?.completedPages, 0, 100, 0),
        0
      );

      triggerCelebration();

      setRecords((prev) => ({
        ...prev,
        [selectedDate]: {
          ...currentRecord,
          completedPages: totalDayCompleted,
          prayers: updatedPrayers
        }
      }));
    } catch (err) {
      console.error('Error saat menandai semua selesai:', err);
    }
  };

  // Date navigations with timezone-safe local shifting
  const handlePrevDay = () => {
    try {
      const sortedDates = Object.keys(records).sort();
      const currIdx = sortedDates.indexOf(selectedDate);
      if (currIdx > 0) {
        setSelectedDate(sortedDates[currIdx - 1]);
      } else {
        setSelectedDate(shiftLocalDateString(selectedDate, -1));
      }
    } catch {
      setSelectedDate(getTodayDateString());
    }
  };

  const handleNextDay = () => {
    try {
      const sortedDates = Object.keys(records).sort();
      const currIdx = sortedDates.indexOf(selectedDate);
      if (currIdx >= 0 && currIdx < sortedDates.length - 1) {
        setSelectedDate(sortedDates[currIdx + 1]);
      } else {
        setSelectedDate(shiftLocalDateString(selectedDate, 1));
      }
    } catch {
      setSelectedDate(getTodayDateString());
    }
  };

  const handleToday = () => {
    setSelectedDate(getTodayDateString());
  };

  // Plan changes with integrity check
  const handleChangePlan = (
    planId: '1x' | '2x' | '3x' | 'custom',
    customTarget?: number,
    customDays?: number
  ) => {
    try {
      const plan = KHATAM_PLANS[planId] || KHATAM_PLANS['1x'];
      const newTargetPages = clampNumber(plan.pagesPerDay, 1, 300, 20);

      setSettings((prev) => ({
        ...prev,
        planId,
        customTargetCount: customTarget !== undefined ? clampNumber(customTarget, 1, 10, 1) : prev.customTargetCount,
        customDays: customDays !== undefined ? clampNumber(customDays, 1, 365, 30) : prev.customDays
      }));

      // Update future records' target
      setRecords((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((d) => {
          if (d >= selectedDate) {
            const rec = updated[d];
            if (rec) {
              const newPrayers = createInitialPrayers(newTargetPages, false);
              updated[d] = {
                ...rec,
                targetPages: newTargetPages,
                prayers: newPrayers
              };
            }
          }
        });
        return updated;
      });
    } catch (err) {
      console.error('Error saat mengubah paket khatam:', err);
    }
  };

  // Pay / Clear debt safely using exact paid amount
  const handlePayDebt = (pagesPaid: number) => {
    try {
      const requestedPay = clampNumber(pagesPaid, 0, 500, 0);
      let remainingToPay = requestedPay;
      if (remainingToPay <= 0) return;

      const sortedDates = Object.keys(records).sort();
      const updated = { ...records };

      for (const date of sortedDates) {
        if (date < selectedDate && remainingToPay > 0) {
          const rec = updated[date];
          if (rec) {
            const target =
              clampNumber(rec.targetPages, 0, 500, 20) +
              clampNumber(rec.debtCarriedOver, 0, 500, 0);
            const completed = clampNumber(rec.completedPages, 0, 500, 0);
            const deficit = target - completed;
            if (deficit > 0) {
              const payment = Math.min(deficit, remainingToPay);
              updated[date] = {
                ...rec,
                completedPages: completed + payment
              };
              remainingToPay -= payment;
            }
          }
        }
      }

      const actualPaid = requestedPay - remainingToPay;
      if (actualPaid <= 0) {
        showToast('Tidak ada tunggakan sebelum tanggal yang dipilih.', 3000);
        return;
      }

      if (updated[selectedDate]) {
        const prevDebtCarried = clampNumber(updated[selectedDate].debtCarriedOver, 0, 500, 0);
        updated[selectedDate] = {
          ...updated[selectedDate],
          debtCarriedOver: Math.max(0, prevDebtCarried - actualPaid)
        };
      }

      setRecords(updated);
      triggerCelebration();
      showToast(`Alhamdulillah! ${actualPaid} halaman utang tilawah berhasil dilunasi.`, 3500);
    } catch (err) {
      console.error('Error saat melunasi utang:', err);
    }
  };

  // Redistribute debt evenly to remaining days
  const handleRedistributeDebt = () => {
    try {
      if (totalDebt <= 0) return;

      const sortedDates = Object.keys(records).sort();
      const remainingDays = sortedDates.filter((d) => d >= selectedDate);

      if (remainingDays.length === 0) return;

      const extraPerDay = Math.ceil(totalDebt / remainingDays.length);
      const updated = { ...records };

      remainingDays.forEach((date) => {
        const rec = updated[date];
        if (rec) {
          const newTarget = clampNumber(rec.targetPages + extraPerDay, 1, 500, 20);
          updated[date] = {
            ...rec,
            targetPages: newTarget,
            prayers: createInitialPrayers(newTarget, rec.completedPages >= newTarget)
          };
        }
      });

      sortedDates.forEach((date) => {
        if (date < selectedDate) {
          const rec = updated[date];
          if (rec) {
            const target =
              clampNumber(rec.targetPages, 0, 500, 20) +
              clampNumber(rec.debtCarriedOver, 0, 500, 0);
            if (rec.completedPages < target) {
              updated[date] = {
                ...rec,
                completedPages: target
              };
            }
          }
        }
      });

      if (updated[selectedDate]) {
        updated[selectedDate] = {
          ...updated[selectedDate],
          debtCarriedOver: 0
        };
      }

      setRecords(updated);
      showToast(`Alhamdulillah! ${totalDebt} halaman utang dibagi rata (+${extraPerDay} hal/hari).`, 4000);
    } catch (err) {
      console.error('Error saat mendistribusikan utang:', err);
    }
  };

  const handleLogin = async () => {
    try {
      setIsSyncing(true);
      const res = await signInWithPopup(auth, googleProvider);
      if (res.user) {
        showToast(`Alhamdulillah! Masuk sebagai ${res.user.displayName || res.user.email}`, 3500);
      }
    } catch (err: unknown) {
      console.error('Google Sign-In Error:', err);
      showToast('Gagal masuk Google. Pastikan izin popup browser aktif.', 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      showToast('Berhasil keluar dari akun Google.', 3000);
    } catch (err) {
      console.error('Sign-Out Error:', err);
    }
  };

  // Bookmark save
  const handleSaveBookmark = (surah: string, ayat: number, page: number) => {
    setSettings((prev) => ({
      ...prev,
      lastReadSurah: sanitizeString(surah, 40) || 'Al-Baqarah',
      lastReadAyat: clampNumber(ayat, 1, 286, 1),
      lastReadPage: clampNumber(page, 1, 604, 2)
    }));
  };

  // Tambah progres tilawah saat membaca langsung di Mushaf Madinah
  const handleAddPageProgress = (pagesToAdd = 1) => {
    try {
      const safeAdd = clampNumber(pagesToAdd, 1, 100, 1);
      const prevCompleted = clampNumber(currentRecord.completedPages, 0, 500, 0);
      const updatedTotal = clampNumber(prevCompleted + safeAdd, 0, 500, 0);

      // Distribusi ke waktu shalat yang belum selesai
      const updatedPrayers = {
        ...createInitialPrayers(currentRecord.targetPages, false),
        ...(currentRecord.prayers || {})
      };
      let remainingToDistribute = safeAdd;

      (['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'] as PrayerTime[]).forEach((key) => {
        const p = updatedPrayers[key];
        if (p && remainingToDistribute > 0) {
          const curPages = clampNumber(p.completedPages, 0, 100, 0);
          const tgtPages = clampNumber(p.targetPages, 1, 100, 4);
          const needed = Math.max(0, tgtPages - curPages);
          if (needed > 0) {
            const add = Math.min(needed, remainingToDistribute);
            const nextPages = curPages + add;
            updatedPrayers[key] = {
              ...p,
              completedPages: nextPages,
              isCompleted: nextPages >= tgtPages
            };
            remainingToDistribute -= add;
          }
        }
      });

      const targetWithDebt =
        clampNumber(currentRecord.targetPages, 0, 500, 20) +
        clampNumber(currentRecord.debtCarriedOver, 0, 500, 0);
      if (prevCompleted < targetWithDebt && updatedTotal >= targetWithDebt && targetWithDebt > 0) {
        triggerCelebration();
      }

      const updatedRecord: DayRecord = {
        ...currentRecord,
        completedPages: updatedTotal,
        prayers: updatedPrayers
      };

      setRecords((prev) => ({
        ...prev,
        [selectedDate]: updatedRecord
      }));

      showToast(`Alhamdulillah! +${safeAdd} halaman tilawah berhasil dicatat.`, 3000);
    } catch (err) {
      console.error('Error saat menambah progres tilawah:', err);
    }
  };

  // Restore from backup JSON
  const handleRestoreData = (
    newSettings: UserSettings,
    newRecords: Record<string, DayRecord>
  ) => {
    try {
      setSettings(newSettings);
      setRecords(newRecords);
      saveSettings(newSettings);
      saveAllRecords(newRecords);

      if (currentUser?.uid && newRecords[selectedDate]) {
        saveDayRecordToFirestore(currentUser.uid, newRecords[selectedDate]).catch((err) =>
          console.warn('Gagal menyinkronkan data pulihan ke cloud:', err)
        );
      }

      triggerCelebration();
      showToast('Alhamdulillah! Data berhasil dipulihkan dari cadangan.', 4000);
    } catch (err) {
      console.error('Gagal menerapkan data pulihan:', err);
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-stone-100/90 text-stone-900 pb-12 relative">
        {/* Toast Notification for Duas & activity */}
        {duaNotification && (
          <div className="no-print fixed top-20 right-4 z-50 bg-emerald-900 text-white px-4 py-2.5 rounded-2xl shadow-xl border border-emerald-700 text-xs font-bold flex items-center gap-2 animate-bounce">
            <span>🤲</span>
            <span>{duaNotification}</span>
          </div>
        )}

        {/* Header with Navigation and Toggles */}
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          totalDebt={totalDebt}
          streak={overallStats.currentStreak}
          soundEnabled={settings.soundEnabled}
          toggleSound={() => setSettings((s) => ({ ...s, soundEnabled: !s.soundEnabled }))}
          isMobileDeviceView={isMobileDeviceView}
          toggleDeviceView={() => setIsMobileDeviceView(!isMobileDeviceView)}
          onOpenNotifications={() => setIsNotificationModalOpen(true)}
          onOpenBackup={() => setIsBackupModalOpen(true)}
          currentUser={currentUser}
          onLogin={handleLogin}
          onLogout={handleLogout}
          isSyncing={isSyncing}
        />

        {/* Main Container */}
        <main className={`max-w-5xl mx-auto px-2.5 sm:px-4 pt-3 sm:pt-6 ${isMobileDeviceView ? 'pb-8' : 'pb-24 md:pb-12'}`}>
          {/* Top Banner when Mode HP is active */}
          {isMobileDeviceView && (
            <div className="no-print max-w-[420px] mx-auto mb-3 px-3 py-2 bg-stone-800 text-stone-200 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-sm">
              <span className="flex items-center gap-1.5 text-amber-300">
                <Smartphone className="w-4 h-4 text-amber-300" />
                <span>Mode HP Android (Fit Layar 390px)</span>
              </span>
              <button
                onClick={() => setIsMobileDeviceView(false)}
                className="text-[11px] px-2 py-1 bg-stone-700 hover:bg-stone-600 text-white rounded-lg transition cursor-pointer flex items-center gap-1"
                title="Beralih kembali ke tampilan layar lebar"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Layar Lebar</span>
              </button>
            </div>
          )}

          {/* Smartphone Chassis if isMobileDeviceView is active */}
          <div className={isMobileDeviceView ? 'max-w-[420px] w-full mx-auto bg-stone-900 rounded-[48px] p-2.5 sm:p-3 shadow-2xl ring-1 ring-stone-800 border-4 border-stone-800 relative print:max-w-full print:bg-transparent print:border-0 print:ring-0 print:shadow-none print:p-0' : ''}>
            {/* Simulated Android Status Bar */}
            {isMobileDeviceView && (
              <div className="no-print px-4 pt-1 pb-2 flex items-center justify-between text-[11px] font-bold text-stone-400 select-none">
                <span>05:00</span>
                <div className="w-20 h-3.5 bg-stone-800 rounded-full flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-stone-950" />
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="font-mono">5G</span>
                  <Wifi className="w-3 h-3" />
                  <Battery className="w-3.5 h-3.5" />
                </div>
              </div>
            )}

            {/* Inner Content Area */}
            <div className={isMobileDeviceView ? 'bg-stone-100 rounded-[38px] p-2.5 sm:p-3 overflow-hidden shadow-inner space-y-4 print:bg-transparent print:rounded-none print:p-0 print:shadow-none' : 'space-y-5'}>
              {/* Tab 1: Progres Harian & Waktu Shalat */}
              {activeTab === 'tracker' && (
                <div className="space-y-4 sm:space-y-5 animate-fadeIn">
                  <DailyDashboard
                    currentRecord={currentRecord}
                    settings={settings}
                    overallStats={overallStats}
                    totalDebt={totalDebt}
                    onPrevDay={handlePrevDay}
                    onNextDay={handleNextDay}
                    onToday={handleToday}
                    onOpenDebtTracker={() => setActiveTab('debt')}
                    onOpenBookmarkModal={() => setIsBookmarkModalOpen(true)}
                    onOpenMushaf={(page) => {
                      if (page) setMushafActivePage(page);
                      setActiveTab('mushaf');
                    }}
                  />

                  <PrayerChecklist
                    currentRecord={currentRecord}
                    onUpdatePrayer={handleUpdatePrayer}
                    onQuickCompleteAll={handleQuickCompleteAll}
                    soundEnabled={settings.soundEnabled}
                  />

                  <WeeklyTrendChart
                    records={records}
                    selectedDate={selectedDate}
                    defaultTargetPages={KHATAM_PLANS[settings?.planId]?.pagesPerDay || 20}
                    onSelectDate={(date) => setSelectedDate(date)}
                  />
                </div>
              )}

              {/* Tab: Al-Qur'an Madinah Terintegrasi */}
              {activeTab === 'mushaf' && (
                <div className="animate-fadeIn">
                  <MushafMadinahReader
                    initialPage={mushafActivePage}
                    lastReadPage={settings?.lastReadPage || 1}
                    onSaveBookmark={handleSaveBookmark}
                    onAddPageProgress={handleAddPageProgress}
                    todayCompletedPages={currentRecord.completedPages}
                    todayTargetPages={currentRecord.targetPages + (currentRecord.debtCarriedOver || 0)}
                    soundEnabled={settings.soundEnabled}
                  />
                </div>
              )}

              {/* Tab 2: Kalender Khatam 30 Hari */}
              {activeTab === 'calendar' && (
                <div className="animate-fadeIn">
                  <KhatamCalendar
                    settings={settings}
                    records={records}
                    selectedDate={selectedDate}
                    onSelectDate={(d) => {
                      setSelectedDate(d);
                      setActiveTab('tracker');
                    }}
                    onChangePlan={handleChangePlan}
                    overallStats={overallStats}
                  />
                </div>
              )}

              {/* Tab 3: Pelacak Utang Halaman */}
              {activeTab === 'debt' && (
                <div className="animate-fadeIn">
                  <DebtTrackerModal
                    records={records}
                    currentDate={selectedDate}
                    totalDebt={totalDebt}
                    settings={settings}
                    onPayDebt={handlePayDebt}
                    onRedistributeDebt={handleRedistributeDebt}
                    onToggleAutoDebt={(enabled) =>
                      setSettings((s) => ({ ...s, autoCarryOverDebt: enabled }))
                    }
                  />
                </div>
              )}

              {/* Tab 4: Printout Resi & Laporan Tilawah */}
              {activeTab === 'report' && (
                <div className="animate-fadeIn">
                  <TilawahReceiptReport
                    records={records}
                    settings={settings}
                    selectedDate={selectedDate}
                    totalDebt={totalDebt}
                    overallStats={overallStats}
                    readerName={settings.userName || currentUser?.displayName || ''}
                    onUpdateReaderName={(name) =>
                      setSettings((prev) => ({ ...prev, userName: sanitizeString(name, 40) }))
                    }
                  />
                </div>
              )}

              {/* Tab 5: Motivasi Keikhlasan & Doa */}
              {activeTab === 'motivation' && (
                <div className="animate-fadeIn">
                  <MotivationCard
                    onOpenReminderSettings={() => setIsNotificationModalOpen(true)}
                  />
                </div>
              )}

              {/* Tab 6: Arsitektur Android Room DB & Kode Kotlin */}
              {activeTab === 'architecture' && (
                <div className="animate-fadeIn">
                  <AndroidArchitectureView />
                </div>
              )}

              {/* Inside Phone Frame Bottom Bar Navigation if Mode HP on Desktop */}
              {isMobileDeviceView && (
                <div className="no-print pt-2 border-t border-stone-200 mt-4">
                  <div className="grid grid-cols-5 gap-1 bg-white rounded-2xl p-1 border border-stone-200 shadow-xs">
                    <button
                      onClick={() => setActiveTab('tracker')}
                      className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition cursor-pointer ${
                        activeTab === 'tracker' ? 'bg-emerald-600 text-white font-bold' : 'text-stone-500 hover:text-stone-800'
                      }`}
                    >
                      <Home className="w-4 h-4" />
                      <span className="text-[9px] mt-0.5">Progres</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('mushaf')}
                      className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition cursor-pointer ${
                        activeTab === 'mushaf' ? 'bg-emerald-600 text-white font-bold' : 'text-stone-500 hover:text-stone-800'
                      }`}
                    >
                      <BookOpen className="w-4 h-4" />
                      <span className="text-[9px] mt-0.5">Mushaf</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('calendar')}
                      className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition cursor-pointer ${
                        activeTab === 'calendar' ? 'bg-emerald-600 text-white font-bold' : 'text-stone-500 hover:text-stone-800'
                      }`}
                    >
                      <Calendar className="w-4 h-4" />
                      <span className="text-[9px] mt-0.5">Kalender</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('report')}
                      className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition cursor-pointer ${
                        activeTab === 'report' ? 'bg-emerald-600 text-white font-bold' : 'text-stone-500 hover:text-stone-800'
                      }`}
                    >
                      <Printer className="w-4 h-4" />
                      <span className="text-[9px] mt-0.5">Resi</span>
                    </button>
                    <button
                      onClick={() => setIsMobileMoreMenuOpen(true)}
                      className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition cursor-pointer relative ${
                        ['debt', 'motivation', 'architecture'].includes(activeTab)
                          ? 'bg-amber-400 text-emerald-950 font-bold'
                          : 'text-stone-500 hover:text-stone-800'
                      }`}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                      <span className="text-[9px] mt-0.5">Lainnya</span>
                      {totalDebt > 0 && (
                        <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      )}
                    </button>
                  </div>

                  {/* Android Home Navigation Line */}
                  <div className="flex justify-center mt-3 mb-1">
                    <div className="w-28 h-1 bg-stone-400 rounded-full" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Global Mobile Sticky Bottom Navigation Bar (Visible on mobile screens) */}
        {!isMobileDeviceView && (
          <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200/90 shadow-lg px-2 py-1.5">
            <div className="max-w-md mx-auto grid grid-cols-5 gap-1">
              <button
                onClick={() => setActiveTab('tracker')}
                className={`flex flex-col items-center justify-center py-1 rounded-xl transition cursor-pointer ${
                  activeTab === 'tracker'
                    ? 'text-emerald-700 font-bold'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <div className={`p-1 rounded-xl ${activeTab === 'tracker' ? 'bg-emerald-100 text-emerald-800' : ''}`}>
                  <Home className="w-4 h-4" />
                </div>
                <span className="text-[10px] mt-0.5">Progres</span>
              </button>

              <button
                onClick={() => setActiveTab('mushaf')}
                className={`flex flex-col items-center justify-center py-1 rounded-xl transition cursor-pointer ${
                  activeTab === 'mushaf'
                    ? 'text-emerald-700 font-bold'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <div className={`p-1 rounded-xl ${activeTab === 'mushaf' ? 'bg-emerald-100 text-emerald-800' : ''}`}>
                  <BookOpen className="w-4 h-4" />
                </div>
                <span className="text-[10px] mt-0.5">Mushaf</span>
              </button>

              <button
                onClick={() => setActiveTab('calendar')}
                className={`flex flex-col items-center justify-center py-1 rounded-xl transition cursor-pointer ${
                  activeTab === 'calendar'
                    ? 'text-emerald-700 font-bold'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <div className={`p-1 rounded-xl ${activeTab === 'calendar' ? 'bg-emerald-100 text-emerald-800' : ''}`}>
                  <Calendar className="w-4 h-4" />
                </div>
                <span className="text-[10px] mt-0.5">Kalender</span>
              </button>

              <button
                onClick={() => setActiveTab('report')}
                className={`flex flex-col items-center justify-center py-1 rounded-xl transition cursor-pointer ${
                  activeTab === 'report'
                    ? 'text-emerald-700 font-bold'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <div className={`p-1 rounded-xl ${activeTab === 'report' ? 'bg-emerald-100 text-emerald-800' : ''}`}>
                  <Printer className="w-4 h-4" />
                </div>
                <span className="text-[10px] mt-0.5">Resi</span>
              </button>

              <button
                onClick={() => setIsMobileMoreMenuOpen(true)}
                className={`flex flex-col items-center justify-center py-1 rounded-xl transition cursor-pointer relative ${
                  ['debt', 'motivation', 'architecture'].includes(activeTab)
                    ? 'text-emerald-700 font-bold'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <div className={`p-1 rounded-xl ${['debt', 'motivation', 'architecture'].includes(activeTab) ? 'bg-amber-100 text-amber-800' : ''}`}>
                  <MoreHorizontal className="w-4 h-4" />
                </div>
                <span className="text-[10px] mt-0.5">Lainnya</span>
                {totalDebt > 0 && (
                  <span className="absolute top-1 right-3 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                )}
              </button>
            </div>
          </nav>
        )}

        {/* Mobile "Lainnya" Drawer Menu Modal */}
        {isMobileMoreMenuOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-slideUp sm:animate-scaleUp p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-200">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                    <MoreHorizontal className="w-4 h-4 text-emerald-700" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900">Menu & Fitur Lainnya</h3>
                    <p className="text-[11px] text-stone-500">Akses cepat ke seluruh fitur aplikasi</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMoreMenuOpen(false)}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Menu items list */}
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setActiveTab('debt');
                    setIsMobileMoreMenuOpen(false);
                  }}
                  className={`w-full p-3 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                    activeTab === 'debt' ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-stone-50 border-stone-200 text-stone-800 hover:bg-stone-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">Pelacak Utang Tilawah</div>
                      <div className="text-[11px] text-stone-500">Qadha dan bagi rata sisa halaman tertinggal</div>
                    </div>
                  </div>
                  {totalDebt > 0 ? (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      {totalDebt} hal
                    </span>
                  ) : (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Tuntas
                    </span>
                  )}
                </button>

                <button
                  onClick={() => {
                    setActiveTab('motivation');
                    setIsMobileMoreMenuOpen(false);
                  }}
                  className={`w-full p-3 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                    activeTab === 'motivation' ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-stone-50 border-stone-200 text-stone-800 hover:bg-stone-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                      <Sparkles className="w-4 h-4 text-emerald-700" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">Motivasi & Doa Harian</div>
                      <div className="text-[11px] text-stone-500">Tadabbur hadits keikhlasan dan doa tilawah</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-stone-400" />
                </button>

                <button
                  onClick={() => {
                    setActiveTab('architecture');
                    setIsMobileMoreMenuOpen(false);
                  }}
                  className={`w-full p-3 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                    activeTab === 'architecture' ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-stone-50 border-stone-200 text-stone-800 hover:bg-stone-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-800 text-amber-300">
                      <Database className="w-4 h-4 text-amber-300" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">Kode Room DB Android</div>
                      <div className="text-[11px] text-stone-500">Struktur tabel SQLite & implementasi Kotlin</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-stone-400" />
                </button>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => {
                      setIsMobileMoreMenuOpen(false);
                      setIsBackupModalOpen(true);
                    }}
                    className="p-3 rounded-2xl border border-stone-200 bg-stone-50 hover:bg-stone-100 transition flex items-center gap-2.5 text-left cursor-pointer"
                  >
                    <HardDrive className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-stone-800">Backup JSON</div>
                      <div className="text-[10px] text-stone-500">Ekspor/impor data</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setIsMobileMoreMenuOpen(false);
                      setIsNotificationModalOpen(true);
                    }}
                    className="p-3 rounded-2xl border border-stone-200 bg-stone-50 hover:bg-stone-100 transition flex items-center gap-2.5 text-left cursor-pointer"
                  >
                    <Bell className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-stone-800">Pengingat Shalat</div>
                      <div className="text-[10px] text-stone-500">Jadwal notifikasi</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-stone-100">
                <button
                  onClick={() => setIsMobileMoreMenuOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modals */}
        {isBookmarkModalOpen && (
          <SurahBookmarkModal
            currentSurah={settings?.lastReadSurah || 'Al-Baqarah'}
            currentAyat={settings?.lastReadAyat || 1}
            currentPage={settings?.lastReadPage || 2}
            onSaveBookmark={handleSaveBookmark}
            onClose={() => setIsBookmarkModalOpen(false)}
          />
        )}

        {isNotificationModalOpen && (
          <NotificationSettingsModal
            settings={settings}
            onUpdateSettings={(newSettings) => setSettings((s) => ({ ...s, ...newSettings }))}
            onClose={() => setIsNotificationModalOpen(false)}
          />
        )}

        {isBackupModalOpen && (
          <BackupModal
            settings={settings}
            records={records}
            onRestoreData={handleRestoreData}
            onClose={() => setIsBackupModalOpen(false)}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
