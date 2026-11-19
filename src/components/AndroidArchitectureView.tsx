import React, { useState, useRef, useEffect } from 'react';
import { Database, Copy, Check, Code, Layers, FileCode, Info } from 'lucide-react';
import { ANDROID_ROOM_EXPLANATION, KOTLIN_ROOM_CODE_SNIPPETS } from '../data/androidCodeSnippets';

export const AndroidArchitectureView: React.FC = () => {
  const [selectedSnippetIndex, setSelectedSnippetIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const activeSnippet = KOTLIN_ROOM_CODE_SNIPPETS[selectedSnippetIndex] || KOTLIN_ROOM_CODE_SNIPPETS[0];

  const handleCopyCode = async () => {
    if (!activeSnippet) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(activeSnippet.code);
        setCopied(true);
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.warn('Gagal menyalin kode ke clipboard:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro Hero Card */}
      <div className="bg-gradient-to-br from-emerald-900 via-emerald-850 to-stone-900 text-white rounded-3xl p-6 sm:p-7 shadow-md relative overflow-hidden">
        <div className="relative z-10 space-y-3">
          <div className="flex items-center gap-2 text-amber-300">
            <span className="p-2 rounded-xl bg-amber-400/20 text-amber-300">
              <Database className="w-5 h-5" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider">
              Arsitektur Database Lokal Android (Room & SQLite)
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            Struktur Data & Implementasi Kode Kotlin Android
          </h2>

          <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed max-w-2xl">
            Panduan lengkap struktur tabel SQLite & Room Database, Entity, DAO, Repository, dan logika otomatis pelacak utang tilawah untuk aplikasi Al-Qur'an Progress Tracker (didukung pula implementasi Flutter SQLite).
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-800/80 border border-emerald-700 text-emerald-200">
              Kotlin 2.0+
            </span>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-800/80 border border-emerald-700 text-emerald-200">
              Android Jetpack Room
            </span>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-800/80 border border-emerald-700 text-emerald-200">
              Coroutines Flow
            </span>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-800/80 border border-emerald-700 text-emerald-200">
              Clean Architecture
            </span>
          </div>
        </div>
      </div>

      {/* Database Schema Visualizer / ERD Tables */}
      <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs space-y-5">
        <div>
          <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600" />
            <span>Skema Tabel & Relasi Data (ERD)</span>
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Tiga tabel utama yang saling terhubung untuk menjamin konsistensi data secara offline
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ANDROID_ROOM_EXPLANATION.tables.map((table, idx) => (
            <div
              key={table.name}
              className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-200">
                  <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                    {table.name}
                  </span>
                  <span className="text-[10px] text-stone-400 font-semibold">Tabel #{idx + 1}</span>
                </div>
                <p className="text-[11px] text-stone-600 mb-3">{table.description}</p>

                <div className="space-y-1.5 font-mono text-[11px]">
                  {table.columns.map((col) => (
                    <div key={col.name} className="p-1.5 rounded-lg bg-white border border-stone-200/80">
                      <div className="flex items-center justify-between text-stone-900 font-bold">
                        <span>{col.name}</span>
                        <span className="text-[10px] text-emerald-600">{col.type}</span>
                      </div>
                      <div className="text-[10px] text-stone-500 font-sans mt-0.5">{col.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Code Snippet Explorer */}
      <div className="bg-stone-900 text-stone-100 rounded-3xl p-5 sm:p-6 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                File Kode Sumber
              </span>
            </div>
            <h3 className="text-base font-bold text-white mt-0.5">{activeSnippet.fileName}</h3>
            <p className="text-xs text-stone-400">{activeSnippet.description}</p>
          </div>

          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer self-start sm:self-auto"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Kode Disalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Salin Kode File Ini</span>
              </>
            )}
          </button>
        </div>

        {/* File Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {KOTLIN_ROOM_CODE_SNIPPETS.map((snip, idx) => (
            <button
              key={snip.fileName}
              onClick={() => setSelectedSnippetIndex(idx)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono whitespace-nowrap transition cursor-pointer ${
                selectedSnippetIndex === idx
                  ? 'bg-stone-800 text-amber-300 font-bold border border-amber-400/40 shadow-xs'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>{snip.fileName}</span>
            </button>
          ))}
        </div>

        {/* Code Block with Syntax Styling */}
        <div className="rounded-2xl bg-black/60 border border-stone-800 p-4 overflow-x-auto max-h-[460px] text-xs font-mono leading-relaxed selection:bg-emerald-600 selection:text-white">
          <pre className="text-stone-200">
            <code>{activeSnippet.code}</code>
          </pre>
        </div>
      </div>

      {/* Detailed Technical Explanations in Indonesian */}
      <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
          <Info className="w-5 h-5 text-emerald-600" />
          <span>Cara Kerja Sistem & Logika Pelacak Utang Halaman</span>
        </h3>

        <div className="space-y-3 text-xs text-stone-700 leading-relaxed">
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
            <h4 className="font-bold text-emerald-950 text-sm mb-1">
              1. Mekanisme Otomatis Penambahan Utang (Debt Rollover)
            </h4>
            <p>
              Pada saat pengguna membuka aplikasi di hari baru (misalnya hari ke-5 Ramadhan), fungsi{' '}
              <code className="font-mono font-bold text-emerald-800">calculateTotalUnpaidDebtBefore(currentDate)</code>{' '}
              pada DAO akan mengevaluasi seluruh hari sebelumnya. Jika ada hari di mana{' '}
              <code className="font-mono text-emerald-900">completed_pages &lt; target_pages</code>, selisih kekurangan tersebut diakumulasikan. Angka ini secara otomatis disimpan pada kolom{' '}
              <code className="font-mono font-bold text-emerald-800">debt_carried_over</code> di hari ini sehingga target harian menjadi:{' '}
              <span className="font-semibold text-emerald-950">Target Baru = Target Normal (20) + Utang Terbawa</span>.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200">
            <h4 className="font-bold text-amber-950 text-sm mb-1">
              2. Pembagian Beban Waktu Shalat Fardhu
            </h4>
            <p>
              Target 1 Juz (20 halaman Mushaf Madinah standar) dibagi secara seimbang ke 5 waktu shalat fardhu (Subuh, Dzuhur, Ashar, Maghrib, Isya) masing-masing 4 halaman. Jika pengguna memilih target 2x khatam, tiap shalat menjadi 8 halaman; untuk 3x khatam menjadi 12 halaman. Hal ini membuat tilawah terasa ringan, teratur, dan tidak membebani di malam hari.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-stone-100 border border-stone-200">
            <h4 className="font-bold text-stone-900 text-sm mb-1">
              3. Pengingat Harian & Motivasi Keikhlasan (WorkManager / AlarmManager)
            </h4>
            <p>
              Pada platform Android Kotlin, gunakan <code className="font-mono font-bold text-stone-800">PeriodicWorkRequestBuilder</code> atau{' '}
              <code className="font-mono font-bold text-stone-800">AlarmManager</code> yang dijadwalkan tepat 10–15 menit setelah waktu shalat fardhu. Notifikasi dikirimkan dengan kutipan hadits tentang keikhlasan berniat, memotivasi pembaca agar ibadahnya murni karena Allah Ta'ala tanpa rasa tertekan.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
