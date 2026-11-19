import React from 'react';
import { Target, CheckCircle2, AlertTriangle, Calendar as CalendarIcon, Info } from 'lucide-react';
import { DayRecord, UserSettings } from '../types/quran';
import { KHATAM_PLANS } from '../data/surahData';
import { safePercentage, clampNumber } from '../utils/sanitize';

interface KhatamCalendarProps {
  settings: UserSettings;
  records: Record<string, DayRecord>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onChangePlan: (planId: '1x' | '2x' | '3x' | 'custom', customTarget?: number, customDays?: number) => void;
  overallStats: {
    totalPagesRead: number;
    totalTargetPages: number;
    totalCompletedDays: number;
    khatamCompletion: number;
  };
}

export const KhatamCalendar: React.FC<KhatamCalendarProps> = ({
  settings,
  records,
  selectedDate,
  onSelectDate,
  onChangePlan,
  overallStats
}) => {
  const currentPlan = KHATAM_PLANS[settings?.planId] || KHATAM_PLANS['1x'];
  const recordList = Object.values(records || {}).sort((a, b) => (a?.dayNumber || 0) - (b?.dayNumber || 0));

  const totalPagesRead = clampNumber(overallStats?.totalPagesRead, 0, 100000, 0);
  const totalTargetPages = clampNumber(overallStats?.totalTargetPages, 1, 100000, 604);
  const overallPercentage = safePercentage(totalPagesRead, totalTargetPages);

  return (
    <div className="space-y-5">
      {/* Target Khatam Selector Card */}
      <div className="bg-white rounded-3xl p-5 shadow-xs border border-stone-200">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <Target className="w-5 h-5 text-emerald-600" />
              <span>Target Khatam Ramadhan</span>
            </h2>
            <p className="text-xs text-stone-500">
              Pilih target untuk menghitung otomatis pembagian halaman harian & per shalat
            </p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
            {currentPlan.count}x Khatam ({currentPlan.pagesPerDay} hal/hari)
          </span>
        </div>

        {/* Plan Option Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {(['1x', '2x', '3x', 'custom'] as const).map((pid) => {
            const plan = KHATAM_PLANS[pid];
            const isSelected = settings?.planId === pid;

            return (
              <button
                key={pid}
                onClick={() => onChangePlan(pid)}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
                  isSelected
                    ? 'bg-emerald-850 text-white border-emerald-950 shadow-md ring-2 ring-emerald-500/30'
                    : 'bg-stone-50 hover:bg-stone-100/80 border-stone-200 text-stone-700'
                }`}
              >
                {isSelected && (
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-amber-400" />
                )}
                <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${isSelected ? 'text-amber-300' : 'text-emerald-700'}`}>
                  {plan.title}
                </div>
                <div className="text-sm font-extrabold">
                  {pid === 'custom' ? `${clampNumber(settings?.customTargetCount, 1, 10, 1)}x Khatam` : `${plan.count * 30} Juz`}
                </div>
                <div className={`text-[11px] mt-0.5 ${isSelected ? 'text-emerald-200' : 'text-stone-500'}`}>
                  {plan.pagesPerPrayer} hal / waktu shalat
                </div>
              </button>
            );
          })}
        </div>

        {/* Plan Explanatory Callout */}
        <div className="mt-3.5 p-3 rounded-xl bg-emerald-50/70 border border-emerald-100 text-xs text-emerald-900 flex items-start gap-2">
          <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong>Kalkulasi Target:</strong> {currentPlan.desc}
          </div>
        </div>
      </div>

      {/* 30-Day Ramadan Interactive Calendar Matrix */}
      <div className="bg-white rounded-3xl p-5 shadow-xs border border-stone-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-emerald-600" />
              <span>Matriks 30 Hari Ramadhan</span>
            </h3>
            <p className="text-xs text-stone-500">
              Klik kotak tanggal untuk melihat dan mencatat progres di hari tersebut
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-[11px] text-stone-500 flex-wrap">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Selesai
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Sebagian
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400" /> Ada Utang
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-stone-200" /> Mendatang
            </span>
          </div>
        </div>

        {/* 30-Day Grid */}
        <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-10 gap-2">
          {recordList.map((rec) => {
            if (!rec || !rec.date) return null;

            const isSelected = rec.date === selectedDate;
            const target = clampNumber(rec.targetPages, 0, 500, 20) + clampNumber(rec.debtCarriedOver, 0, 500, 0);
            const completed = clampNumber(rec.completedPages, 0, 500, 0);
            const isDone = completed >= target && target > 0;
            const hasStarted = completed > 0;
            const isPast = rec.date < selectedDate;
            const hasDebt = isPast && !isDone;

            let badgeBg = 'bg-stone-50 text-stone-600 border-stone-200';
            if (isDone) {
              badgeBg = 'bg-emerald-600 text-white border-emerald-700 shadow-xs';
            } else if (hasDebt) {
              badgeBg = 'bg-red-50 text-red-700 border-red-300';
            } else if (hasStarted) {
              badgeBg = 'bg-amber-100 text-amber-900 border-amber-300';
            }

            return (
              <button
                key={rec.date}
                onClick={() => onSelectDate(rec.date)}
                className={`relative p-2 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-between min-h-[64px] ${badgeBg} ${
                  isSelected ? 'ring-2 ring-emerald-500 ring-offset-2 scale-105 z-10 font-bold' : 'hover:scale-102'
                }`}
              >
                <div className="text-[10px] uppercase font-semibold opacity-80">
                  H-{rec.dayNumber || 1}
                </div>

                <div className="my-1">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-white mx-auto" />
                  ) : hasDebt ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 mx-auto" />
                  ) : (
                    <span className="text-xs font-bold">{completed}</span>
                  )}
                </div>

                <div className="text-[9px] opacity-75 font-mono">
                  {completed}/{target}
                </div>
              </button>
            );
          })}
        </div>

        {/* Overall Khatam Progress Bar */}
        <div className="pt-3 border-t border-stone-200 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-stone-600 font-medium">Akumulasi Khatam Seluruh Bulan</span>
            <span className="font-extrabold text-emerald-800">
              {totalPagesRead} / {totalTargetPages} Halaman ({overallPercentage}%)
            </span>
          </div>
          <div className="w-full h-3 rounded-full bg-stone-100 overflow-hidden border border-stone-200">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, overallPercentage)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
