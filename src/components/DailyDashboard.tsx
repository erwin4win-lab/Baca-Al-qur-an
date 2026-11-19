import React from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, Bookmark, Flame, AlertTriangle, ArrowRight } from 'lucide-react';
import { DayRecord, UserSettings } from '../types/quran';
import { safePercentage, clampNumber } from '../utils/sanitize';

interface DailyDashboardProps {
  currentRecord: DayRecord;
  settings: UserSettings;
  overallStats: {
    totalPagesRead: number;
    totalTargetPages: number;
    currentJuz: number;
    khatamCompletion: number;
  };
  totalDebt: number;
  onPrevDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
  onOpenDebtTracker: () => void;
  onOpenBookmarkModal: () => void;
  onOpenMushaf?: (page?: number) => void;
}

export const DailyDashboard: React.FC<DailyDashboardProps> = ({
  currentRecord,
  settings,
  overallStats,
  totalDebt,
  onPrevDay,
  onNextDay,
  onToday,
  onOpenDebtTracker,
  onOpenBookmarkModal,
  onOpenMushaf
}) => {
  const safeTarget = clampNumber(currentRecord?.targetPages, 1, 300, 20);
  const safeDebt = clampNumber(currentRecord?.debtCarriedOver, 0, 300, 0);
  const safeCompleted = clampNumber(currentRecord?.completedPages, 0, 500, 0);

  const targetWithDebt = safeTarget + safeDebt;
  const percentage = safePercentage(safeCompleted, targetWithDebt);

  const isCompleted = safeCompleted >= targetWithDebt && targetWithDebt > 0;
  const remaining = Math.max(0, targetWithDebt - safeCompleted);

  // Format date safely with try-catch
  let dateFormatted = currentRecord?.date || 'Hari Ini';
  try {
    if (currentRecord?.date) {
      const parts = currentRecord.date.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const dateObj = new Date(year, month, day);
        dateFormatted = dateObj.toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      }
    }
  } catch {
    dateFormatted = currentRecord?.date || 'Hari Ini';
  }

  // SVG Radial circle math
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="space-y-4">
      {/* Date Navigation Bar */}
      <div className="bg-white rounded-2xl p-3 shadow-xs border border-stone-200/80 flex items-center justify-between">
        <button
          onClick={onPrevDay}
          className="p-2 rounded-xl text-stone-600 hover:text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
          title="Hari Sebelumnya"
          aria-label="Hari Sebelumnya"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              Hari ke-{currentRecord?.dayNumber || 1}
            </span>
            <span className="text-xs text-stone-500 font-medium hidden sm:inline">Menuju Ramadhan</span>
          </div>
          <p className="text-sm font-semibold text-stone-800 mt-0.5">{dateFormatted}</p>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onToday}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition cursor-pointer"
            title="Kembali ke Hari Ini"
          >
            Hari Ini
          </button>
          <button
            onClick={onNextDay}
            className="p-2 rounded-xl text-stone-600 hover:text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
            title="Hari Berikutnya"
            aria-label="Hari Berikutnya"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Daily Progress Card */}
      <div className="bg-gradient-to-br from-emerald-800 via-emerald-850 to-emerald-950 text-white rounded-3xl p-5 sm:p-6 shadow-md relative overflow-hidden">
        {/* Subtle decorative Islamic pattern circles */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-emerald-600/10 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-amber-400/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-5 sm:gap-6">
          {/* Circular Progress Ring & Details */}
          <div className="flex items-center gap-3.5 sm:gap-5 w-full sm:w-auto">
            <div className="relative w-24 h-24 sm:w-32 sm:h-32 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 128 128">
                {/* Background Ring */}
                <circle
                  cx="64"
                  cy="64"
                  r={radius}
                  className="text-emerald-900/60"
                  strokeWidth="10"
                  stroke="currentColor"
                  fill="transparent"
                />
                {/* Progress Ring */}
                <circle
                  cx="64"
                  cy="64"
                  r={radius}
                  className={`transition-all duration-700 ease-out ${
                    isCompleted ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                  strokeWidth="10"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xl sm:text-2xl font-extrabold tracking-tight">
                  {percentage}%
                </span>
                <span className="text-[9px] sm:text-[10px] text-emerald-200 uppercase tracking-wider font-semibold">
                  {isCompleted ? 'Tuntas' : 'Target'}
                </span>
              </div>
            </div>

            {/* Target Breakdown Details */}
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs uppercase tracking-wider text-emerald-300 font-bold">
                  Target Harian
                </span>
                {isCompleted && (
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    <CheckCircle2 className="w-3 h-3 text-amber-400" /> Barakallah!
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold text-white">
                  {safeCompleted}
                </span>
                <span className="text-xs sm:text-sm text-emerald-200">
                  / {targetWithDebt} halaman
                </span>
              </div>

              {safeDebt > 0 ? (
                <p className="text-[11px] sm:text-xs text-amber-300 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Termasuk utang kemarin: <strong>+{safeDebt}</strong> hal</span>
                </p>
              ) : (
                <p className="text-[11px] sm:text-xs text-emerald-200/90">
                  Target normal: {safeTarget} halaman (1 Juz)
                </p>
              )}

              <p className="text-[11px] sm:text-xs text-emerald-300/80">
                {remaining > 0 ? (
                  <span>Sisa <strong className="text-white">{remaining}</strong> halaman lagi hari ini</span>
                ) : (
                  <span className="text-amber-300 font-semibold">Semua target hari ini selesai!</span>
                )}
              </p>
            </div>
          </div>

          {/* Quick Stats Cards (Grid on mobile to avoid horizontal squashing) */}
          <div className="w-full lg:w-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 border-t lg:border-t-0 lg:border-l border-emerald-700/60 pt-3 lg:pt-0 lg:pl-5">
            {/* Juz Position */}
            <div className="bg-emerald-900/60 rounded-xl p-2.5 border border-emerald-700/40">
              <div className="text-[10px] text-emerald-300 uppercase font-semibold">Posisi Tilawah</div>
              <div className="text-sm font-bold text-white flex items-center justify-between gap-2">
                <span>Juz {overallStats.currentJuz || 1} dari 30</span>
                <span className="text-xs text-amber-300 font-mono">
                  {clampNumber(currentRecord?.dayNumber, 1, 30, 1) * 20}/604
                </span>
              </div>
            </div>

            {/* Bookmark button */}
            <button
              onClick={onOpenBookmarkModal}
              className="flex items-center justify-between gap-2 bg-emerald-700/50 hover:bg-emerald-700/80 transition rounded-xl p-2.5 border border-emerald-600/40 text-left cursor-pointer"
            >
              <div className="min-w-0">
                <div className="text-[10px] text-emerald-300 uppercase font-semibold flex items-center gap-1">
                  <Bookmark className="w-3 h-3 text-amber-300 shrink-0" /> Penanda Terakhir
                </div>
                <div className="text-xs font-semibold text-white truncate max-w-[150px]">
                  {settings?.lastReadSurah || 'Al-Baqarah'}: {settings?.lastReadAyat || 1}
                </div>
              </div>
              <span className="text-[10px] text-amber-300 font-bold bg-emerald-950/60 px-2 py-0.5 rounded shrink-0">Hal {settings?.lastReadPage || 1}</span>
            </button>

            {/* Buka Mushaf Madinah direct launcher */}
            {onOpenMushaf && (
              <button
                onClick={() => onOpenMushaf(settings?.lastReadPage || 1)}
                className="sm:col-span-2 lg:col-span-1 flex items-center justify-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-emerald-950 transition rounded-xl p-2.5 font-bold text-xs cursor-pointer shadow-xs"
                title="Buka Al-Qur'an Mushaf Madinah pada penanda terakhir"
              >
                <span>Buka Mushaf Madinah</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Utang Alert Banner if there is uncarried/accumulated debt */}
        {totalDebt > 0 && (
          <div className="mt-4 pt-3 border-t border-emerald-700/60 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-300">
              <Flame className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Total akumulasi utang halaman yang belum terbayar: <strong className="text-white underline">{totalDebt} halaman</strong>
              </span>
            </div>
            <button
              onClick={onOpenDebtTracker}
              className="shrink-0 flex items-center gap-1 text-xs font-bold text-emerald-950 bg-amber-400 hover:bg-amber-300 px-3 py-1 rounded-lg transition cursor-pointer"
            >
              <span>Atur Pelunasan</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
