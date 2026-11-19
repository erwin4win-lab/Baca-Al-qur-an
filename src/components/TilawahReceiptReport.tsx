import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Printer, Copy, Check, Download, Receipt, FileText, FileDown } from 'lucide-react';
import { DayRecord, PrayerTime, UserSettings } from '../types/quran';
import { KHATAM_PLANS } from '../data/surahData';
import { clampNumber, safePercentage, sanitizeString } from '../utils/sanitize';
import { generateReceiptPdf } from '../utils/pdfReceipt';

interface TilawahReceiptReportProps {
  records: Record<string, DayRecord>;
  settings: UserSettings;
  selectedDate: string;
  totalDebt: number;
  overallStats: {
    totalPagesRead: number;
    totalTargetPages: number;
    totalCompletedDays: number;
    currentStreak: number;
    maxStreak: number;
    currentJuz: number;
    khatamCompletion: number;
  };
  readerName: string;
  onUpdateReaderName: (name: string) => void;
}

type ReportPeriod = 'today' | 'week' | 'all';
type ReceiptLayout = 'thermal' | 'a4';

const PRAYER_LABELS: { key: PrayerTime; label: string }[] = [
  { key: 'subuh', label: 'Shubuh' },
  { key: 'dzuhur', label: 'Dzuhur' },
  { key: 'ashar', label: 'Ashar' },
  { key: 'maghrib', label: 'Maghrib' },
  { key: 'isya', label: 'Isya' }
];

function formatDateIndo(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    }
  } catch {
    // fallback
  }
  return dateStr;
}

function formatShortDDMM(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return dateStr;
}

export const TilawahReceiptReport: React.FC<TilawahReceiptReportProps> = ({
  records,
  settings,
  selectedDate,
  totalDebt,
  overallStats,
  readerName,
  onUpdateReaderName
}) => {
  const [period, setPeriod] = useState<ReportPeriod>('week');
  const [layout, setLayout] = useState<ReceiptLayout>('thermal');
  const [copied, setCopied] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revokeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      if (revokeTimerRef.current) clearTimeout(revokeTimerRef.current);
    };
  }, []);

  const plan = KHATAM_PLANS[settings?.planId] || KHATAM_PLANS['1x'];
  const displayName = sanitizeString(readerName || settings?.userName || 'Sahabat Qur\'an', 40) || 'Sahabat Qur\'an';

  const printedAt = useMemo(() => {
    try {
      return new Date().toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  const receiptNumber = useMemo(() => {
    const compactDate = selectedDate.replace(/-/g, '');
    return `MQ-${compactDate}-${String(overallStats.totalPagesRead).padStart(3, '0')}`;
  }, [selectedDate, overallStats.totalPagesRead]);

  // Filter records for selected period
  const periodRecords = useMemo(() => {
    const allDates = Object.keys(records || {}).sort();
    if (period === 'today') {
      const rec = records?.[selectedDate];
      return rec ? [rec] : [];
    }
    if (period === 'week') {
      // 7 consecutive days ending at selectedDate
      const parts = selectedDate.split('-');
      const end = parts.length === 3
        ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
        : new Date();
      const targetDates: string[] = [];
      for (let i = -6; i <= 0; i++) {
        const d = new Date(end);
        d.setDate(end.getDate() + i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        targetDates.push(`${y}-${m}-${day}`);
      }
      return targetDates
        .map((dateStr, idx) => {
          const existing = records?.[dateStr];
          if (existing) return existing;
          return {
            date: dateStr,
            dayNumber: idx + 1,
            targetPages: plan.pagesPerDay,
            completedPages: 0,
            debtCarriedOver: 0,
            debtAdded: 0,
            prayers: {} as DayRecord['prayers']
          };
        });
    }
    // 'all': show all records up to today or with activity/scheduled days
    return allDates
      .map((d) => records[d])
      .filter((r) => Boolean(r) && (r.completedPages > 0 || r.date <= selectedDate));
  }, [records, period, selectedDate, plan.pagesPerDay]);

  const periodTotals = useMemo(() => {
    let completed = 0;
    let target = 0;
    let metCount = 0;

    periodRecords.forEach((r) => {
      const c = clampNumber(r.completedPages, 0, 500, 0);
      const t = clampNumber(r.targetPages, 1, 500, plan.pagesPerDay) + clampNumber(r.debtCarriedOver, 0, 500, 0);
      completed += c;
      target += t;
      if (c >= t && t > 0) metCount++;
    });

    return {
      completed,
      target,
      metCount,
      percentage: safePercentage(completed, Math.max(1, target))
    };
  }, [periodRecords, plan.pagesPerDay]);

  const periodLabel =
    period === 'today'
      ? `Harian (${formatDateIndo(selectedDate)})`
      : period === 'week'
      ? `7 Hari Terakhir (s.d. ${formatDateIndo(selectedDate)})`
      : 'Seluruh Periode Aktif';

  const todayRecord = records?.[selectedDate];

  const generatePlainTextReceipt = () => {
    const lineEq = '========================================';
    const lineDash = '----------------------------------------';
    const lines: string[] = [
      '         MUTABA\'AH QUR\'AN 1446H',
      '       RESI LAPORAN TILAWAH HARIAN',
      lineEq,
      `No. Resi : ${receiptNumber}`,
      `Tanggal  : ${printedAt}`,
      `Pembaca  : ${displayName}`,
      `Program  : ${plan.title} (${plan.pagesPerDay} hal/hr)`,
      `Periode  : ${periodLabel}`,
      lineDash
    ];

    if (period === 'today' && todayRecord) {
      lines.push('RINCIAN 5 WAKTU SHALAT:');
      PRAYER_LABELS.forEach(({ key, label }) => {
        const p = todayRecord.prayers?.[key];
        const done = clampNumber(p?.completedPages, 0, 100, 0);
        const tgt = clampNumber(p?.targetPages, 1, 100, 4);
        const status = p?.isCompleted ? '[OK]' : '[  ]';
        const padLabel = label.padEnd(9, ' ');
        const pageStr = `${done}/${tgt} hal`.padStart(9, ' ');
        lines.push(`${padLabel} ${pageStr}  ${status}`);
      });
    } else {
      lines.push('REKAP HARIAN:');
      periodRecords.forEach((r) => {
        const done = clampNumber(r.completedPages, 0, 500, 0);
        const tgt = clampNumber(r.targetPages, 1, 500, plan.pagesPerDay) + clampNumber(r.debtCarriedOver, 0, 500, 0);
        const status = done >= tgt ? 'TUNTAS' : done > 0 ? 'PROSES' : 'KOSONG';
        lines.push(`${formatShortDDMM(r.date)} (H-${String(r.dayNumber).padStart(2, '0')})  ${String(done).padStart(3, ' ')}/${String(tgt).padEnd(3, ' ')} hal  [${status}]`);
      });
    }

    lines.push(
      lineDash,
      `Capaian Periode : ${periodTotals.completed} / ${periodTotals.target} hal (${periodTotals.percentage}%)`,
      `Hari Tuntas     : ${periodTotals.metCount} / ${periodRecords.length} hari`,
      `Total Akumulasi : ${overallStats.totalPagesRead} / ${overallStats.totalTargetPages} hal`,
      `Sisa Utang      : ${totalDebt} hal`,
      `Posisi Terakhir : Juz ${overallStats.currentJuz} · ${settings.lastReadSurah || 'Al-Baqarah'} (Hal ${settings.lastReadPage || 1})`,
      `Streak Ibadah   : ${overallStats.currentStreak} hari berturut-turut`,
      lineEq,
      '   "Sebaik-baik kalian adalah yang',
      '   belajar Al-Qur\'an & mengajarkannya"',
      lineEq
    );

    return lines.join('\n');
  };

  const showNotice = (msg: string, duration = 4000) => {
    setActionNotice(msg);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setActionNotice(null), duration);
  };

  const handleDownloadPdf = () => {
    try {
      const filename = generateReceiptPdf({
        layout,
        period,
        receiptNumber,
        printedAt,
        readerName: displayName,
        planTitle: plan.title,
        pagesPerDay: plan.pagesPerDay,
        periodLabel,
        selectedDate,
        todayRecord,
        periodRecords,
        periodTotals,
        overallStats,
        totalDebt,
        lastReadSurah: settings.lastReadSurah || 'Al-Baqarah',
        lastReadPage: settings.lastReadPage || 1
      });
      showNotice(`File PDF berhasil diunduh: ${filename}`, 4000);
    } catch (err) {
      console.error('Gagal membuat PDF:', err);
      showNotice('Gagal membuat PDF. Silakan coba Unduh .TXT atau Salin Teks.', 4000);
    }
  };

  const handlePrint = () => {
    try {
      const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
      window.print();
      if (isInIframe) {
        showNotice('Jika dialog print tidak muncul di mode pratinjau, gunakan tombol "Unduh PDF" di sebelah kanan.', 5000);
      }
    } catch {
      showNotice('Browser memblokir dialog cetak langsung. Gunakan tombol "Unduh PDF".', 5000);
    }
  };

  const handleCopyText = async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        showNotice('Clipboard tidak tersedia pada browser ini.', 3000);
        return;
      }
      await navigator.clipboard.writeText(generatePlainTextReceipt());
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      showNotice('Gagal menyalin teks ke clipboard.', 3000);
    }
  };

  const handleDownloadTxt = () => {
    try {
      const content = generatePlainTextReceipt();
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resi-mutabaah-${selectedDate}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (revokeTimerRef.current) clearTimeout(revokeTimerRef.current);
      revokeTimerRef.current = setTimeout(() => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore cleanup error
        }
      }, 1000);
    } catch {
      showNotice('Gagal mengunduh file teks.', 3000);
    }
  };

  return (
    <div className="space-y-4">
      {/* Control Panel (hidden when printing) */}
      <section className="no-print bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-stone-200/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-stone-900">
              Cetak Resi & Laporan Tilawah
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Unduh PDF langsung atau cetak printout mutaba'ah format struk & A4
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Tersalin' : 'Salin Teks'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadTxt}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>.TXT</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold transition cursor-pointer"
              title="Cetak langsung ke printer browser"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              title="Buat dan unduh file PDF secara langsung"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Unduh PDF</span>
            </button>
          </div>
        </div>

        {actionNotice && (
          <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium">
            {actionNotice}
          </div>
        )}

        {/* Options Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-stone-100">
          {/* Period Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-stone-500 mb-1.5">
              Periode Laporan
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-stone-100 rounded-xl">
              <button
                type="button"
                onClick={() => setPeriod('today')}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  period === 'today' ? 'bg-white text-emerald-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => setPeriod('week')}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  period === 'week' ? 'bg-white text-emerald-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                7 Hari
              </button>
              <button
                type="button"
                onClick={() => setPeriod('all')}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  period === 'all' ? 'bg-white text-emerald-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Semua
              </button>
            </div>
          </div>

          {/* Layout Format Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-stone-500 mb-1.5">
              Format Cetak
            </label>
            <div className="grid grid-cols-2 gap-1 p-1 bg-stone-100 rounded-xl">
              <button
                type="button"
                onClick={() => setLayout('thermal')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  layout === 'thermal' ? 'bg-white text-emerald-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Resi Struk</span>
              </button>
              <button
                type="button"
                onClick={() => setLayout('a4')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  layout === 'a4' ? 'bg-white text-emerald-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Laporan A4</span>
              </button>
            </div>
          </div>

          {/* Reader Name Input */}
          <div>
            <label htmlFor="receipt-reader-name" className="block text-[11px] font-semibold text-stone-500 mb-1.5">
              Nama pada Resi
            </label>
            <input
              id="receipt-reader-name"
              type="text"
              maxLength={40}
              value={readerName}
              onChange={(e) => onUpdateReaderName(e.target.value)}
              placeholder="Masukkan nama Anda..."
              className="w-full px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:border-emerald-500 focus:outline-none text-xs font-medium text-stone-800"
            />
          </div>
        </div>
      </section>

      {/* Printable Receipt / Report Canvas */}
      {layout === 'thermal' ? (
        <div
          id="printable-receipt-area"
          className="max-w-[380px] mx-auto bg-white border border-stone-300 shadow-md px-5 py-6 font-mono text-stone-900 text-xs relative"
        >
          {/* Perforated top strip feel */}
          <div className="border-b-2 border-dashed border-stone-300 pb-4 text-center space-y-1">
            <div className="text-sm font-bold tracking-wider text-stone-900">
              MUTABA'AH QUR'AN 1446H
            </div>
            <div className="text-[11px] text-stone-600 uppercase tracking-wide">
              Resi Pencatatan Tilawah
            </div>
          </div>

          {/* Receipt Metadata */}
          <div className="py-3 border-b border-dashed border-stone-300 space-y-1.5 tabular-nums text-[11px]">
            <div className="flex justify-between gap-2">
              <span className="text-stone-500">NO. RESI</span>
              <span className="font-bold text-stone-900">{receiptNumber}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-stone-500">WAKTU CETAK</span>
              <span className="text-stone-800 text-right">{printedAt}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-stone-500">PEMBACA</span>
              <span className="font-semibold text-stone-900 text-right truncate max-w-[180px]">{displayName}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-stone-500">PROGRAM</span>
              <span className="text-stone-800 text-right">{plan.title} ({plan.pagesPerDay} hal/hr)</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-stone-500">PERIODE</span>
              <span className="text-stone-800 text-right">{periodLabel}</span>
            </div>
          </div>

          {/* Itemized Rows */}
          <div className="py-3 border-b border-dashed border-stone-300 space-y-2 tabular-nums">
            {period === 'today' && todayRecord ? (
              <>
                <div className="flex justify-between text-[10px] font-bold text-stone-500 uppercase pb-1">
                  <span>Waktu Shalat</span>
                  <span>Capaian</span>
                </div>
                {PRAYER_LABELS.map(({ key, label }) => {
                  const p = todayRecord.prayers?.[key];
                  const done = clampNumber(p?.completedPages, 0, 100, 0);
                  const tgt = clampNumber(p?.targetPages, 1, 100, 4);
                  return (
                    <div key={key} className="space-y-0.5">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-stone-800">{label}</span>
                        <span>
                          <strong>{done}</strong>/{tgt} hal{' '}
                          <span className={p?.isCompleted ? 'font-bold text-emerald-700' : 'text-stone-400'}>
                            [{p?.isCompleted ? 'OK' : '..'}]
                          </span>
                        </span>
                      </div>
                      {p?.surahNote && (
                        <div className="text-[10px] text-stone-500 pl-2">
                          Catatan: {p.surahNote}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            ) : (
              <>
                <div className="flex justify-between text-[10px] font-bold text-stone-500 uppercase pb-1">
                  <span>Tanggal (Hari)</span>
                  <span>Halaman / Status</span>
                </div>
                {periodRecords.length === 0 ? (
                  <div className="text-center py-3 text-stone-400">
                    Belum ada catatan tilawah pada periode ini.
                  </div>
                ) : (
                  periodRecords.map((r) => {
                    const done = clampNumber(r.completedPages, 0, 500, 0);
                    const tgt = clampNumber(r.targetPages, 1, 500, plan.pagesPerDay) + clampNumber(r.debtCarriedOver, 0, 500, 0);
                    const met = done >= tgt && tgt > 0;
                    return (
                      <div key={r.date} className="flex justify-between items-center">
                        <span className="text-stone-700">
                          {formatShortDDMM(r.date)}{' '}
                          <span className="text-stone-400">(H-{r.dayNumber})</span>
                        </span>
                        <span>
                          <strong>{done}</strong>/{tgt} hal{' '}
                          <span className={met ? 'font-bold text-emerald-700' : done > 0 ? 'text-amber-700' : 'text-stone-400'}>
                            [{met ? 'OK' : done > 0 ? '..' : '--'}]
                          </span>
                        </span>
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>

          {/* Summary Totals */}
          <div className="py-3 border-b-2 border-dashed border-stone-300 space-y-1.5 tabular-nums">
            <div className="flex justify-between text-xs font-bold text-stone-900">
              <span>TOTAL PERIODE</span>
              <span>
                {periodTotals.completed} / {periodTotals.target} hal ({periodTotals.percentage}%)
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-stone-700">
              <span>HARI CAPAI TARGET</span>
              <span className="font-semibold">{periodTotals.metCount} / {periodRecords.length} hari</span>
            </div>
            <div className="flex justify-between text-[11px] text-stone-700">
              <span>PROGRES KHATAM</span>
              <span className="font-semibold">
                {overallStats.totalPagesRead} / {overallStats.totalTargetPages} hal ({overallStats.khatamCompletion}%)
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-stone-700">
              <span>SISA UTANG HALAMAN</span>
              <span className={totalDebt > 0 ? 'font-bold text-amber-700' : 'font-semibold text-emerald-700'}>
                {totalDebt} hal
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-stone-700">
              <span>STREAK ISTIQOMAH</span>
              <span className="font-semibold">{overallStats.currentStreak} hari</span>
            </div>
            <div className="flex justify-between text-[11px] text-stone-700">
              <span>PENANDA TERAKHIR</span>
              <span className="text-right">
                Juz {overallStats.currentJuz} · {settings.lastReadSurah || 'Al-Baqarah'} (Hal {settings.lastReadPage || 1})
              </span>
            </div>
          </div>

          {/* Receipt Footer */}
          <div className="pt-4 text-center space-y-2">
            <p className="text-[10px] leading-relaxed text-stone-600 italic">
              "Sebaik-baik kalian adalah yang mempelajari Al-Qur'an dan mengajarkannya." (HR. Bukhari)
            </p>
            <div className="text-[10px] tracking-[0.25em] text-stone-400 pt-1">
              *** BARAKALLAHU FIIKUM ***
            </div>
          </div>
        </div>
      ) : (
        <div
          id="printable-receipt-area"
          className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 sm:p-8 space-y-6 text-stone-900"
        >
          {/* Report Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-stone-200">
            <div>
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                Laporan Mutaba'ah Tilawah
              </p>
              <h3 className="text-xl font-bold text-stone-900 mt-1">
                {displayName}
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                Program {plan.title} ({plan.pagesPerDay} hal/hari) · Periode {periodLabel}
              </p>
            </div>
            <div className="sm:text-right text-xs text-stone-600 tabular-nums space-y-0.5">
              <div>
                No. Dokumen: <strong className="text-stone-900 font-mono">{receiptNumber}</strong>
              </div>
              <div>Dicetak: {printedAt}</div>
              <div>
                Penanda: <strong className="text-stone-900">{settings.lastReadSurah || 'Al-Baqarah'}</strong> (Hal {settings.lastReadPage || 1})
              </div>
            </div>
          </div>

          {/* 4 Summary Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-5 border-b border-stone-200 tabular-nums">
            <div>
              <div className="text-xs text-stone-500">Halaman Periode Ini</div>
              <div className="text-xl font-bold text-stone-900 mt-0.5">
                {periodTotals.completed} <span className="text-xs font-normal text-stone-500">/ {periodTotals.target} hal</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-stone-500">Total Akumulasi</div>
              <div className="text-xl font-bold text-emerald-700 mt-0.5">
                {overallStats.totalPagesRead} <span className="text-xs font-normal text-stone-500">hal ({overallStats.khatamCompletion}%)</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-stone-500">Streak Istiqomah</div>
              <div className="text-xl font-bold text-stone-900 mt-0.5">
                {overallStats.currentStreak} <span className="text-xs font-normal text-stone-500">hari</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-stone-500">Sisa Utang Tilawah</div>
              <div className={`text-xl font-bold mt-0.5 ${totalDebt > 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
                {totalDebt} <span className="text-xs font-normal text-stone-500">hal</span>
              </div>
            </div>
          </div>

          {/* Detailed Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs tabular-nums">
              <thead>
                <tr className="border-b border-stone-300 text-stone-600 font-semibold">
                  <th className="py-2 pr-3">Tanggal</th>
                  <th className="py-2 px-2 text-center">Shubuh</th>
                  <th className="py-2 px-2 text-center">Dzuhur</th>
                  <th className="py-2 px-2 text-center">Ashar</th>
                  <th className="py-2 px-2 text-center">Maghrib</th>
                  <th className="py-2 px-2 text-center">Isya</th>
                  <th className="py-2 px-2 text-right">Capaian</th>
                  <th className="py-2 pl-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {periodRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-stone-400">
                      Belum ada data bacaan untuk periode ini.
                    </td>
                  </tr>
                ) : (
                  periodRecords.map((r) => {
                    const done = clampNumber(r.completedPages, 0, 500, 0);
                    const tgt = clampNumber(r.targetPages, 1, 500, plan.pagesPerDay) + clampNumber(r.debtCarriedOver, 0, 500, 0);
                    const met = done >= tgt && tgt > 0;
                    return (
                      <tr key={r.date} className="hover:bg-stone-50/70">
                        <td className="py-2.5 pr-3 font-medium text-stone-800 whitespace-nowrap">
                          {formatDateIndo(r.date)}{' '}
                          <span className="text-stone-400 font-normal">· Hari {r.dayNumber}</span>
                        </td>
                        {PRAYER_LABELS.map(({ key }) => (
                          <td key={key} className="py-2.5 px-2 text-center text-stone-600">
                            {clampNumber(r.prayers?.[key]?.completedPages, 0, 100, 0)}
                          </td>
                        ))}
                        <td className="py-2.5 px-2 text-right font-semibold text-stone-900 whitespace-nowrap">
                          {done} / {tgt} hal
                        </td>
                        <td className={`py-2.5 pl-3 text-right font-semibold whitespace-nowrap ${
                          met ? 'text-emerald-700' : done > 0 ? 'text-amber-600' : 'text-stone-400'
                        }`}>
                          {met ? 'Tuntas' : done > 0 ? 'Proses' : 'Kosong'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Report Footer */}
          <div className="pt-4 border-t border-stone-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-stone-500">
            <span>Mutaba'ah Qur'an · Pelacak Progres Tilawah & Penjaga Istiqomah</span>
            <span>Posisi saat ini: Juz {overallStats.currentJuz} dari 30</span>
          </div>
        </div>
      )}
    </div>
  );
};
