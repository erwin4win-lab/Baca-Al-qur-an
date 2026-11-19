import React, { useState } from 'react';
import { Check, Plus, Minus, Edit2, Sparkles, CheckCheck } from 'lucide-react';
import { DayRecord, PrayerProgress, PrayerTime } from '../types/quran';
import { soundManager } from '../utils/audioNotification';
import { clampNumber, sanitizeString } from '../utils/sanitize';

interface PrayerChecklistProps {
  currentRecord: DayRecord;
  onUpdatePrayer: (prayerKey: PrayerTime, isCompleted: boolean, pages: number, surahNote?: string) => void;
  onQuickCompleteAll: () => void;
  soundEnabled: boolean;
}

const PRAYER_DETAILS: Record<PrayerTime, { tip: string; icon: string }> = {
  subuh: {
    tip: 'Waktu paling sejuk dan disaksikan malaikat (QS. Al-Isra\': 78).',
    icon: '🌅'
  },
  dzuhur: {
    tip: 'Penyegar hati dan rehat ruhani di sela kesibukan siang hari.',
    icon: '☀️'
  },
  ashar: {
    tip: 'Menjaga semangat sore hari sebelum menyambut senja.',
    icon: '🌤️'
  },
  maghrib: {
    tip: 'Membuka waktu malam dengan cahaya kalamullah bersama keluarga.',
    icon: '🌇'
  },
  isya: {
    tip: 'Menutup hari dengan damai sebelum istirahat malam yang berkah.',
    icon: '🌙'
  }
};

export const PrayerChecklist: React.FC<PrayerChecklistProps> = ({
  currentRecord,
  onUpdatePrayer,
  onQuickCompleteAll,
  soundEnabled
}) => {
  const [editingPrayer, setEditingPrayer] = useState<PrayerTime | null>(null);
  const [noteInput, setNoteInput] = useState('');

  const prayers = currentRecord?.prayers || ({} as Record<PrayerTime, PrayerProgress>);
  const prayerKeys: PrayerTime[] = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'];

  const completedCount = prayerKeys.filter((k) => prayers[k]?.isCompleted).length;
  const isAllCompleted = completedCount === 5;

  const handleToggle = (prayerKey: PrayerTime) => {
    const p = prayers[prayerKey];
    if (!p) return;

    const newCompleted = !p.isCompleted;
    const safeTarget = clampNumber(p.targetPages, 1, 100, 4);
    const newPages = newCompleted ? (p.completedPages > 0 ? p.completedPages : safeTarget) : 0;

    if (soundEnabled) {
      if (newCompleted) soundManager.playSuccess();
      else soundManager.playTap();
    }

    onUpdatePrayer(prayerKey, newCompleted, newPages, p.surahNote);
  };

  const handleAdjustPages = (prayerKey: PrayerTime, delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const p = prayers[prayerKey];
    if (!p) return;

    const currentPages = clampNumber(p.completedPages, 0, 100, 0);
    const newPages = clampNumber(currentPages + delta, 0, 100, 0);
    const safeTarget = clampNumber(p.targetPages, 1, 100, 4);
    const newCompleted = newPages >= safeTarget;

    if (soundEnabled) soundManager.playTap();
    onUpdatePrayer(prayerKey, newCompleted, newPages, p.surahNote);
  };

  const handleSaveNote = (prayerKey: PrayerTime) => {
    const p = prayers[prayerKey];
    if (!p) return;
    const cleanNote = sanitizeString(noteInput, 80);
    onUpdatePrayer(prayerKey, p.isCompleted, p.completedPages, cleanNote || undefined);
    setEditingPrayer(null);
  };

  return (
    <div className="space-y-3">
      {/* Header section with completion progress */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
            <span>Pembagian 5 Waktu Shalat</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {completedCount} / 5 Waktu Selesai
            </span>
          </h2>
          <p className="text-xs text-stone-500">
            Target rutin: {prayers.subuh?.targetPages || 4} halaman setiap usai shalat fardhu
          </p>
        </div>

        {!isAllCompleted && (
          <button
            onClick={onQuickCompleteAll}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-850 hover:bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200 transition cursor-pointer flex items-center gap-1"
            title="Tandai semua shalat hari ini selesai"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Tandai Semua Selesai</span>
          </button>
        )}
      </div>

      {/* 5 Prayer Cards List */}
      <div className="grid grid-cols-1 gap-2.5">
        {prayerKeys.map((key) => {
          const prayer = prayers[key] || {
            prayer: key,
            name: key.toUpperCase(),
            arabicName: '',
            targetPages: 4,
            completedPages: 0,
            isCompleted: false
          };

          const detail = PRAYER_DETAILS[key];
          const isDone = prayer.isCompleted || (prayer.completedPages >= prayer.targetPages && prayer.targetPages > 0);
          const isEditing = editingPrayer === key;

          return (
            <div
              key={key}
              className={`rounded-2xl p-3.5 sm:p-4 border transition-all ${
                isDone
                  ? 'bg-emerald-50/70 border-emerald-300 shadow-xs'
                  : 'bg-white border-stone-200 hover:border-emerald-200 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between gap-2 sm:gap-3">
                {/* Left: Icon, Name & Arabic */}
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                  {/* Large Checkbox Button */}
                  <button
                    onClick={() => handleToggle(key)}
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                      isDone
                        ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400/50'
                        : 'border-2 border-stone-300 hover:border-emerald-500 text-transparent bg-stone-50'
                    }`}
                    title={isDone ? 'Klik untuk membatalkan' : `Selesaikan ${prayer.name}`}
                    aria-label={`Selesaikan tilawah usai ${prayer.name}`}
                  >
                    <Check className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform ${isDone ? 'scale-100' : 'scale-75'}`} />
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="text-sm sm:text-base font-bold text-stone-900">{prayer.name}</span>
                      <span className="font-arabic text-emerald-800 text-xs sm:text-sm font-semibold">
                        {prayer.arabicName}
                      </span>
                      <span className="text-xs text-stone-400">{detail.icon}</span>
                    </div>

                    <p className="text-[10px] sm:text-[11px] text-stone-500 hidden sm:block truncate">
                      {detail.tip}
                    </p>

                    {prayer.surahNote && (
                      <div className="text-[10px] sm:text-[11px] font-medium text-emerald-800 bg-emerald-100/70 px-1.5 sm:px-2 py-0.5 rounded-md inline-block mt-0.5 max-w-[170px] sm:max-w-none truncate">
                        📖 {prayer.surahNote}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Pages Counter Stepper & Controls */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <div className="flex items-center bg-stone-100 rounded-xl p-0.5 sm:p-1 border border-stone-200/80">
                    <button
                      onClick={(e) => handleAdjustPages(key, -1, e)}
                      disabled={prayer.completedPages <= 0}
                      className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-stone-600 hover:bg-white hover:text-stone-900 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                      title="Kurangi 1 halaman"
                    >
                      <Minus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    </button>

                    <div className="px-1.5 sm:px-2 text-center min-w-[46px] sm:min-w-[56px]">
                      <span className={`text-xs sm:text-sm font-extrabold ${isDone ? 'text-emerald-700' : 'text-stone-800'}`}>
                        {clampNumber(prayer.completedPages, 0, 100, 0)}
                      </span>
                      <span className="text-[10px] sm:text-[11px] text-stone-500 font-medium">/{prayer.targetPages} hal</span>
                    </div>

                    <button
                      onClick={(e) => handleAdjustPages(key, 1, e)}
                      className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-stone-600 hover:bg-white hover:text-stone-900 transition cursor-pointer"
                      title="Tambah 1 halaman"
                    >
                      <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    </button>
                  </div>

                  {/* Add/Edit Note Button */}
                  <button
                    onClick={() => {
                      setEditingPrayer(isEditing ? null : key);
                      setNoteInput(prayer.surahNote || '');
                    }}
                    className={`p-1.5 sm:p-2 rounded-xl border transition cursor-pointer ${
                      prayer.surahNote
                        ? 'border-emerald-300 text-emerald-700 bg-emerald-50'
                        : 'border-stone-200 text-stone-400 hover:text-stone-700 hover:bg-stone-50'
                    }`}
                    title="Catat Surah & Ayat untuk waktu ini"
                    aria-label="Catat Surah dan Ayat"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Note input inline drawer */}
              {isEditing && (
                <div className="mt-3 pt-3 border-t border-stone-200/80 flex items-center gap-2 animate-fadeIn">
                  <input
                    type="text"
                    maxLength={80}
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Contoh: Al-Baqarah 1-25 (Hal 2-5)"
                    className="flex-1 text-xs px-3 py-2 rounded-xl bg-white border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveNote(key);
                    }}
                  />
                  <button
                    onClick={() => handleSaveNote(key)}
                    className="text-xs font-semibold px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer"
                  >
                    Simpan
                  </button>
                  <button
                    onClick={() => setEditingPrayer(null)}
                    className="text-xs font-medium px-2 py-2 rounded-xl text-stone-500 hover:text-stone-800 transition cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Motivational Bottom Tip */}
      <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200/80 flex items-start gap-2.5">
        <Sparkles className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-xs text-amber-900 leading-relaxed">
          <strong>Kunci Keberkahan:</strong> Membagi tilawah ke 5 waktu shalat fardhu (masing-masing 4 halaman) membuat 1 Juz per hari terasa sangat ringan dan melatih keistiqomahan hati.
        </div>
      </div>
    </div>
  );
};
