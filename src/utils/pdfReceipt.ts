import { jsPDF } from 'jspdf';
import { DayRecord, PrayerTime } from '../types/quran';
import { clampNumber, isValidDateString } from './sanitize';

export interface ReceiptPdfPayload {
  layout: 'thermal' | 'a4';
  period: 'today' | 'week' | 'all';
  receiptNumber: string;
  printedAt: string;
  readerName: string;
  planTitle: string;
  pagesPerDay: number;
  periodLabel: string;
  selectedDate: string;
  todayRecord?: DayRecord;
  periodRecords: DayRecord[];
  periodTotals: {
    completed: number;
    target: number;
    metCount: number;
    percentage: number;
  };
  overallStats: {
    totalPagesRead: number;
    totalTargetPages: number;
    totalCompletedDays: number;
    currentStreak: number;
    currentJuz: number;
    khatamCompletion: number;
  };
  totalDebt: number;
  lastReadSurah: string;
  lastReadPage: number;
}

const PRAYER_LABELS: { key: PrayerTime; label: string }[] = [
  { key: 'subuh', label: 'Shubuh' },
  { key: 'dzuhur', label: 'Dzuhur' },
  { key: 'ashar', label: 'Ashar' },
  { key: 'maghrib', label: 'Maghrib' },
  { key: 'isya', label: 'Isya' }
];

function safeAscii(text: string): string {
  return String(text || '').replace(/[^\x20-\x7E]/g, "'");
}

function sanitizeAsciiLabel(text: unknown, fallback: string): string {
  const cleaned = safeAscii(typeof text === 'string' ? text : '').trim();
  return cleaned || fallback;
}

function formatShortDDMM(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return dateStr;
}

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
    // ignore
  }
  return dateStr;
}

/**
 * Generates and downloads a real PDF file for either 80mm thermal receipt or A4 full report.
 * Works reliably inside sandboxed iframes, mobile browsers, and desktop without relying on window.print().
 */
export function generateReceiptPdf(payload: ReceiptPdfPayload): string {
  if (!payload || !isValidDateString(payload.selectedDate)) {
    throw new Error('Data laporan tidak valid untuk dicetak ke PDF.');
  }

  const safePeriodRecords = Array.isArray(payload.periodRecords) ? payload.periodRecords.filter(Boolean) : [];
  const safeReaderName = sanitizeAsciiLabel(payload.readerName, "Sahabat Qur'an");
  const safePlanTitle = sanitizeAsciiLabel(payload.planTitle, '1x Khatam');
  const safePagesPerDay = clampNumber(payload.pagesPerDay, 1, 500, 20);
  const safeTotalDebt = clampNumber(payload.totalDebt, 0, 5000, 0);

  const filename =
    payload.layout === 'thermal'
      ? `resi-mutabaah-${payload.selectedDate}.pdf`
      : `laporan-mutabaah-${payload.selectedDate}.pdf`;

  if (payload.layout === 'thermal') {
    const itemCount =
      payload.period === 'today' && payload.todayRecord
        ? PRAYER_LABELS.length + 2
        : Math.max(1, safePeriodRecords.length);

    // Dynamic receipt height (80mm width) so all rows fit on one continuous receipt roll
    const estimatedHeight = Math.max(135, 98 + itemCount * 5.2);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, estimatedHeight]
    });

    const left = 5;
    const right = 75;
    const center = 40;
    let y = 9;

    doc.setFont('courier', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(20, 20, 20);
    doc.text("MUTABA'AH QUR'AN 1446H", center, y, { align: 'center' });
    y += 4.5;

    doc.setFont('courier', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);
    doc.text('RESI PENCATATAN TILAWAH', center, y, { align: 'center' });
    y += 4;

    doc.setDrawColor(160, 160, 160);
    doc.setLineDashPattern([1.2, 1.2], 0);
    doc.line(left, y, right, y);
    y += 4.5;

    const metaRows: [string, string][] = [
      ['NO. RESI', safeAscii(payload.receiptNumber)],
      ['WAKTU', safeAscii(payload.printedAt)],
      ['PEMBACA', safeReaderName],
      ['PROGRAM', `${safePlanTitle} (${safePagesPerDay}h/hr)`],
      ['PERIODE', safeAscii(payload.periodLabel)]
    ];

    doc.setFontSize(7);
    metaRows.forEach(([label, value]) => {
      doc.setFont('courier', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(label, left, y);
      doc.setFont('courier', 'bold');
      doc.setTextColor(25, 25, 25);
      const truncated = value.length > 26 ? `${value.slice(0, 24)}..` : value;
      doc.text(truncated, right, y, { align: 'right' });
      y += 4;
    });

    y += 0.5;
    doc.line(left, y, right, y);
    y += 4.5;

    if (payload.period === 'today' && payload.todayRecord) {
      doc.setFont('courier', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(90, 90, 90);
      doc.text('WAKTU SHALAT', left, y);
      doc.text('CAPAIAN', right, y, { align: 'right' });
      y += 4;

      PRAYER_LABELS.forEach(({ key, label }) => {
        const p = payload.todayRecord?.prayers?.[key];
        const done = clampNumber(p?.completedPages, 0, 100, 0);
        const tgt = clampNumber(p?.targetPages, 1, 100, 4);
        const status = p?.isCompleted ? '[OK]' : '[..]';

        doc.setFont('courier', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(25, 25, 25);
        doc.text(label, left, y);
        doc.setFont('courier', 'bold');
        doc.text(`${done}/${tgt} hal ${status}`, right, y, { align: 'right' });
        y += 4.2;

        if (p?.surahNote) {
          doc.setFont('courier', 'normal');
          doc.setFontSize(6.5);
          doc.setTextColor(100, 100, 100);
          doc.text(`  * ${safeAscii(p.surahNote).slice(0, 34)}`, left, y);
          y += 3.5;
        }
      });
    } else {
      doc.setFont('courier', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(90, 90, 90);
      doc.text('TANGGAL', left, y);
      doc.text('HALAMAN / STATUS', right, y, { align: 'right' });
      y += 4;

      if (safePeriodRecords.length === 0) {
        doc.setFont('courier', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 120);
        doc.text('Belum ada catatan pada periode ini.', center, y, { align: 'center' });
        y += 5;
      } else {
        safePeriodRecords.forEach((r) => {
          const done = clampNumber(r.completedPages, 0, 500, 0);
          const tgt =
            clampNumber(r.targetPages, 1, 500, safePagesPerDay) +
            clampNumber(r.debtCarriedOver, 0, 500, 0);
          const met = done >= tgt && tgt > 0;
          const badge = met ? '[OK]' : done > 0 ? '[..]' : '[--]';

          doc.setFont('courier', 'normal');
          doc.setFontSize(7.2);
          doc.setTextColor(40, 40, 40);
          doc.text(`${formatShortDDMM(r.date)} (H-${clampNumber(r.dayNumber, 1, 365, 1)})`, left, y);

          doc.setFont('courier', 'bold');
          doc.setTextColor(met ? 5 : 40, met ? 120 : 40, met ? 85 : 40);
          doc.text(`${done}/${tgt} hal ${badge}`, right, y, { align: 'right' });
          y += 4.2;
        });
      }
    }

    y += 1;
    doc.line(left, y, right, y);
    y += 4.5;

    const summaryRows: [string, string, boolean?][] = [
      [
        'TOTAL PERIODE',
        `${clampNumber(payload.periodTotals?.completed, 0, 100000, 0)}/${clampNumber(payload.periodTotals?.target, 0, 100000, 0)} hal (${clampNumber(payload.periodTotals?.percentage, 0, 100, 0)}%)`,
        true
      ],
      ['HARI TUNTAS', `${clampNumber(payload.periodTotals?.metCount, 0, 1000, 0)} / ${safePeriodRecords.length} hari`],
      [
        'PROGRES KHATAM',
        `${clampNumber(payload.overallStats?.totalPagesRead, 0, 100000, 0)}/${clampNumber(payload.overallStats?.totalTargetPages, 1, 100000, 604)} (${clampNumber(payload.overallStats?.khatamCompletion, 0, 100, 0)}%)`
      ],
      ['SISA UTANG', `${safeTotalDebt} hal`],
      ['STREAK', `${clampNumber(payload.overallStats?.currentStreak, 0, 1000, 0)} hari`],
      ['PENANDA', `Juz ${clampNumber(payload.overallStats?.currentJuz, 1, 30, 1)} Hal ${clampNumber(payload.lastReadPage, 1, 604, 1)}`]
    ];

    summaryRows.forEach(([label, val, bold]) => {
      doc.setFont('courier', bold ? 'bold' : 'normal');
      doc.setFontSize(bold ? 7.5 : 7);
      doc.setTextColor(20, 20, 20);
      doc.text(label, left, y);
      doc.setFont('courier', 'bold');
      doc.text(safeAscii(val), right, y, { align: 'right' });
      y += 4.2;
    });

    y += 1;
    doc.line(left, y, right, y);
    y += 5;

    doc.setFont('courier', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(90, 90, 90);
    doc.text('"Sebaik-baik kalian adalah yang belajar', center, y, { align: 'center' });
    y += 3.2;
    doc.text("Al-Qur'an dan mengajarkannya.\" (HR. Bukhari)", center, y, { align: 'center' });
    y += 4.5;

    doc.setFont('courier', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text('*** BARAKALLAHU FIIKUM ***', center, y, { align: 'center' });

    doc.save(filename);
    return filename;
  }

  // A4 Full Report Layout
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const margin = 15;
  const pageWidth = 210;
  const contentWidth = pageWidth - margin * 2;
  let y = 18;

  // Header accent strip
  doc.setFillColor(6, 95, 70); // emerald-800
  doc.rect(0, 0, pageWidth, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(5, 150, 105);
  doc.text("LAPORAN MUTABA'AH TILAWAH AL-QUR'AN", margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 100, 100);
  doc.text(`No. Dokumen: ${payload.receiptNumber}`, pageWidth - margin, y, { align: 'right' });
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(28, 25, 23);
  doc.text(safeReaderName, margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 100, 100);
  doc.text(`Dicetak: ${safeAscii(payload.printedAt)}`, pageWidth - margin, y, { align: 'right' });
  y += 5.5;

  doc.setFontSize(9.5);
  doc.setTextColor(87, 83, 78);
  doc.text(
    `Program ${safePlanTitle} (${safePagesPerDay} hal/hari)  |  Periode: ${safeAscii(payload.periodLabel)}`,
    margin,
    y
  );
  y += 6;

  doc.setDrawColor(214, 211, 209);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 7;

  // 4 Summary KPI Blocks
  const colW = contentWidth / 4;
  const kpis: [string, string, [number, number, number]][] = [
    [
      'Halaman Periode Ini',
      `${clampNumber(payload.periodTotals?.completed, 0, 100000, 0)} / ${clampNumber(payload.periodTotals?.target, 0, 100000, 0)} hal`,
      [28, 25, 23]
    ],
    [
      'Total Akumulasi',
      `${clampNumber(payload.overallStats?.totalPagesRead, 0, 100000, 0)} hal (${clampNumber(payload.overallStats?.khatamCompletion, 0, 100, 0)}%)`,
      [4, 120, 87]
    ],
    ['Streak Istiqomah', `${clampNumber(payload.overallStats?.currentStreak, 0, 1000, 0)} hari`, [28, 25, 23]],
    [
      'Sisa Utang Tilawah',
      `${safeTotalDebt} hal`,
      safeTotalDebt > 0 ? [217, 119, 6] : [4, 120, 87]
    ]
  ];

  kpis.forEach(([title, val, color], idx) => {
    const x = margin + idx * colW;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 113, 108);
    doc.text(title, x, y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(val, x, y + 6);
  });

  y += 12;
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Table Header
  const drawTableHeader = (currY: number) => {
    doc.setFillColor(245, 245, 244);
    doc.rect(margin, currY - 4.5, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(68, 64, 60);

    doc.text('Tanggal', margin + 2, currY);
    doc.text('Shubuh', margin + 52, currY, { align: 'center' });
    doc.text('Dzuhur', margin + 70, currY, { align: 'center' });
    doc.text('Ashar', margin + 88, currY, { align: 'center' });
    doc.text('Maghrib', margin + 106, currY, { align: 'center' });
    doc.text('Isya', margin + 124, currY, { align: 'center' });
    doc.text('Capaian', margin + 152, currY, { align: 'right' });
    doc.text('Status', pageWidth - margin - 2, currY, { align: 'right' });
    return currY + 6.5;
  };

  y = drawTableHeader(y);

  if (safePeriodRecords.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(120, 113, 108);
    doc.text('Belum ada data bacaan untuk periode ini.', pageWidth / 2, y + 6, { align: 'center' });
    y += 14;
  } else {
    safePeriodRecords.forEach((r, idx) => {
      if (y > 272) {
        doc.addPage();
        y = 20;
        y = drawTableHeader(y);
      }

      if (idx % 2 === 1) {
        doc.setFillColor(250, 250, 249);
        doc.rect(margin, y - 4, contentWidth, 6.2, 'F');
      }

      const done = clampNumber(r.completedPages, 0, 500, 0);
      const tgt =
        clampNumber(r.targetPages, 1, 500, safePagesPerDay) +
        clampNumber(r.debtCarriedOver, 0, 500, 0);
      const met = done >= tgt && tgt > 0;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(41, 37, 36);
      doc.text(`${safeAscii(formatDateIndo(r.date))} (H-${clampNumber(r.dayNumber, 1, 365, 1)})`, margin + 2, y);

      const prayerXs = [margin + 52, margin + 70, margin + 88, margin + 106, margin + 124];
      PRAYER_LABELS.forEach(({ key }, pIdx) => {
        const val = clampNumber(r.prayers?.[key]?.completedPages, 0, 100, 0);
        doc.setTextColor(87, 83, 78);
        doc.text(String(val), prayerXs[pIdx], y, { align: 'center' });
      });

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(28, 25, 23);
      doc.text(`${done} / ${tgt} hal`, margin + 152, y, { align: 'right' });

      if (met) {
        doc.setTextColor(4, 120, 87);
        doc.text('Tuntas', pageWidth - margin - 2, y, { align: 'right' });
      } else if (done > 0) {
        doc.setTextColor(217, 119, 6);
        doc.text('Proses', pageWidth - margin - 2, y, { align: 'right' });
      } else {
        doc.setTextColor(168, 162, 158);
        doc.text('Kosong', pageWidth - margin - 2, y, { align: 'right' });
      }

      y += 6.2;
    });
  }

  y += 6;
  if (y > 275) {
    doc.addPage();
    y = 20;
  }

  doc.setDrawColor(214, 211, 209);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 113, 108);
  doc.text("Mutaba'ah Qur'an · Pelacak Progres Tilawah & Penjaga Istiqomah", margin, y);
  doc.text(
    `Penanda terakhir: Juz ${payload.overallStats.currentJuz} · ${safeAscii(payload.lastReadSurah)} (Hal ${payload.lastReadPage})`,
    pageWidth - margin,
    y,
    { align: 'right' }
  );

  doc.save(filename);
  return filename;
}
