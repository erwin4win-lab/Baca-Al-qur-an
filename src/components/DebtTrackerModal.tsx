import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, X, ArrowRight, ShieldCheck, Heart } from 'lucide-react';
import { DayRecord, UserSettings } from '../types/quran';
import { clampNumber } from '../utils/sanitize';

interface DebtTrackerModalProps {
  records: Record<string, DayRecord>;
  currentDate: string;
  totalDebt: number;
  settings: UserSettings;
  onPayDebt: (pages: number) => void;
  onRedistributeDebt: () => void;
  onToggleAutoDebt: (enabled: boolean) => void;
  onClose?: () => void;
}

export const DebtTrackerModal: React.FC<DebtTrackerModalProps> = ({
  records,
  currentDate,
  totalDebt,
  settings,
  onPayDebt,
  onRedistributeDebt,
  onToggleAutoDebt,
  onClose
}) => {
  const safeDebt = clampNumber(totalDebt, 0, 1000, 0);
  const [payAmount, setPayAmount] = useState<number>(safeDebt > 0 ? Math.min(safeDebt, 4) : 4);
  const [justPaidSuccess, setJustPaidSuccess] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Update payAmount when totalDebt decreases
  useEffect(() => {
    if (safeDebt > 0 && payAmount > safeDebt) {
      setPayAmount(safeDebt);
    }
  }, [safeDebt, payAmount]);

  // Identify past dates with missed targets safely
  const debtDays = Object.values(records || {})
    .filter((r) => {
      if (!r || !r.date) return false;
      const isPast = r.date < currentDate;
      const target = clampNumber(r.targetPages, 0, 500, 20) + clampNumber(r.debtCarriedOver, 0, 500, 0);
      const completed = clampNumber(r.completedPages, 0, 500, 0);
      return isPast && completed < target;
    })
    .map((r) => {
      const target = clampNumber(r.targetPages, 0, 500, 20) + clampNumber(r.debtCarriedOver, 0, 500, 0);
      const completed = clampNumber(r.completedPages, 0, 500, 0);
      return {
        date: r.date,
        dayNumber: r.dayNumber || 1,
        target,
        completed,
        deficit: Math.max(0, target - completed)
      };
    });

  const handlePay = () => {
    if (payAmount <= 0) return;
    const finalAmount = Math.min(payAmount, safeDebt);
    onPayDebt(finalAmount);
    setJustPaidSuccess(true);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setJustPaidSuccess(false), 3000);
  };

  const quickPayOptions = Array.from(new Set([2, 4, 6, safeDebt]))
    .filter((amount) => amount > 0 && amount <= safeDebt)
    .sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      {/* Top Banner Card */}
      <div className="bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 text-white rounded-3xl p-5 sm:p-6 shadow-md relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-400/30 text-white">
                <AlertTriangle className="w-5 h-5 text-amber-100" />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold">Pelacak Utang Tilawah (Qadha Halaman)</h2>
                <p className="text-xs text-amber-100">Solusi cerdas agar target tilawah tidak menumpuk di akhir bulan</p>
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg bg-amber-700/50 hover:bg-amber-800 text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="mt-5 flex items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-black">{safeDebt}</span>
            <span className="text-base text-amber-100 font-semibold">halaman tertinggal</span>
          </div>

          <p className="text-xs text-amber-100/90 mt-1 max-w-xl">
            {safeDebt > 0
              ? 'Ada sisa bacaan dari hari-hari sebelumnya yang belum sempat diselesaikan. Jangan khawatir, Anda bisa melunasinya sekarang atau membaginya secara bertahap ke sisa hari Ramadhan!'
              : 'Alhamdulillah! Tidak ada utang tilawah yang tertunda. Semua target hari-hari sebelumnya telah tuntas tercapai.'}
          </p>
        </div>
      </div>

      {/* Auto-Carry Over Toggle Settings Card */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-stone-900">
              Otomatis Bawa Utang ke Target Hari Berikutnya
            </div>
            <p className="text-[11px] text-stone-500">
              Jika hari ini tidak mencapai 20 halaman, sisa halaman otomatis ditambahkan ke target esok hari.
            </p>
          </div>
        </div>

        <button
          onClick={() => onToggleAutoDebt(!settings?.autoCarryOverDebt)}
          className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
            settings?.autoCarryOverDebt ? 'bg-emerald-600' : 'bg-stone-300'
          }`}
          aria-label="Toggle auto carry over debt"
        >
          <span
            className={`w-5 h-5 rounded-full bg-white shadow-md block transition-transform ${
              settings?.autoCarryOverDebt ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Action Options: Pay Now vs Redistribute */}
      {safeDebt > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Pelunasan Langsung */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
              <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 text-xs flex items-center justify-center font-bold">1</span>
              <span>Lunasi Utang Sekarang (Qadha Langsung)</span>
            </div>
            <p className="text-xs text-stone-500">
              Baru saja membaca beberapa halaman ekstra untuk mencicil utang? Catat di sini:
            </p>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-stone-100 rounded-xl p-1 border border-stone-200 flex-1">
                {quickPayOptions.map((amount) => (
                  <button
                    key={`pay-option-${amount}`}
                    onClick={() => setPayAmount(amount)}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                      payAmount === amount
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-stone-700 hover:bg-stone-200/70'
                    }`}
                  >
                    +{amount} hal
                  </button>
                ))}
              </div>

              <button
                onClick={handlePay}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>Bayar Utang</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {justPaidSuccess && (
              <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-1.5 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Alhamdulillah! Berhasil melunasi {payAmount} halaman utang tilawah.</span>
              </div>
            )}
          </div>

          {/* Card 2: Distribusi Rata ke Sisa Hari */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
                <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 text-xs flex items-center justify-center font-bold">2</span>
                <span>Distribusi Cerdas ke Sisa Hari Ramadhan</span>
              </div>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                Daripada menumpuk di satu hari, bagi rata {safeDebt} halaman utang ini ke sisa hari yang masih ada, sehingga beban harian hanya bertambah sedikit (±1-2 halaman per hari).
              </p>
            </div>

            <button
              onClick={onRedistributeDebt}
              className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs mt-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Bagi Rata Utang ke Sisa Hari</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 text-center space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
          <h3 className="text-sm font-bold text-emerald-950">Catatan Tilawah Anda Sangat Rapi!</h3>
          <p className="text-xs text-emerald-800 max-w-md mx-auto">
            Semua target harian telah terpenuhi sesuai rencana. Pertahankan keistiqomahan ini dengan niat tulus karena Allah SWT.
          </p>
        </div>
      )}

      {/* History of Missed Days */}
      {debtDays.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs">
          <h3 className="text-xs font-bold text-stone-800 mb-2.5 flex items-center gap-1.5">
            <span>Rincian Hari yang Mengalami Kekurangan Target:</span>
          </h3>
          <div className="divide-y divide-stone-100">
            {debtDays.map((d) => (
              <div key={d.date} className="py-2 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-stone-800">Hari ke-{d.dayNumber} ({d.date})</span>
                  <div className="text-[11px] text-stone-500">
                    Terbaca: {d.completed} dari {d.target} halaman
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                  Kurang {d.deficit} hal
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spiritual Encouragement */}
      <div className="p-4 bg-stone-100/80 rounded-2xl border border-stone-200 text-xs text-stone-600 flex items-start gap-3">
        <Heart className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-stone-800">Nasehat Keikhlasan:</strong> Jangan biarkan rasa bersalah atas utang tilawah membuat Anda putus asa. Allah menilai ketulusan niat dan kesungguhan Anda untuk terus kembali membuka mushaf-Nya.
        </div>
      </div>
    </div>
  );
};
