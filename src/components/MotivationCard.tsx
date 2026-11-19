import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Bell, Heart, BookOpen, Copy, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { ISLAMIC_MOTIVATION_QUOTES, DUAS_QURAN } from '../data/motivationQuotes';
import { sendLocalNotification, requestNotificationPermission } from '../utils/audioNotification';

interface MotivationCardProps {
  onOpenReminderSettings: () => void;
}

export const MotivationCard: React.FC<MotivationCardProps> = ({ onOpenReminderSettings }) => {
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [notificationTestStatus, setNotificationTestStatus] = useState<string | null>(null);

  const copyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const notifTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    };
  }, []);

  const totalQuotes = ISLAMIC_MOTIVATION_QUOTES.length;
  const quote = ISLAMIC_MOTIVATION_QUOTES[currentQuoteIndex] || ISLAMIC_MOTIVATION_QUOTES[0];

  const handleNextQuote = () => {
    setCurrentQuoteIndex((prev) => (prev + 1) % totalQuotes);
  };

  const handlePrevQuote = () => {
    setCurrentQuoteIndex((prev) => (prev - 1 + totalQuotes) % totalQuotes);
  };

  const handleCopy = (text: string, key: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);

      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedKey(null), 2000);
    } catch (e) {
      console.warn('Gagal menyalin teks ke clipboard:', e);
    }
  };

  const handleTestNotification = async () => {
    try {
      const granted = await requestNotificationPermission();
      const title = 'Waktunya Menjenguk Al-Qur\'an 📖';
      const body = `"${quote.translation.slice(0, 80)}..." - Luruskan niat ikhlas karena Allah.`;

      sendLocalNotification(title, body);
      setNotificationTestStatus(
        granted
          ? 'Notifikasi berhasil dikirim ke perangkat Anda!'
          : 'Simulasi notifikasi aktif (Izin sistem browser belum diberikan)'
      );

      if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
      notifTimerRef.current = setTimeout(() => setNotificationTestStatus(null), 4000);
    } catch (err) {
      console.warn('Uji notifikasi gagal:', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Main Islamic Motivation Card */}
      <div className="bg-gradient-to-br from-emerald-850 via-emerald-900 to-stone-900 text-white rounded-3xl p-6 sm:p-7 shadow-md relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-400/20 text-amber-300">
                <Heart className="w-4 h-4 fill-amber-300" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Tadabbur & Keikhlasan Hati
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevQuote}
                className="p-1.5 rounded-lg bg-emerald-800/80 hover:bg-emerald-700 text-emerald-200 transition cursor-pointer"
                title="Hadits Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-emerald-300 px-1 font-mono">
                {currentQuoteIndex + 1}/{totalQuotes}
              </span>
              <button
                onClick={handleNextQuote}
                className="p-1.5 rounded-lg bg-emerald-800/80 hover:bg-emerald-700 text-emerald-200 transition cursor-pointer"
                title="Hadits Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Arabic Text */}
          <div className="py-2 text-center sm:text-right">
            <p className="font-arabic text-2xl sm:text-3xl leading-loose sm:leading-[2.2] text-amber-200 dir-rtl tracking-wide">
              {quote.arabic}
            </p>
          </div>

          {/* Translation */}
          <blockquote className="border-l-2 border-amber-400/60 pl-4 py-1 text-sm sm:text-base italic text-emerald-50 leading-relaxed">
            "{quote.translation}"
          </blockquote>

          {/* Source & Theme */}
          <div className="flex items-center justify-between text-xs text-emerald-300/90 pt-1">
            <span className="font-semibold text-amber-300">{quote.source}</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-800/80 text-[10px] uppercase font-bold tracking-wider">
              Tema: {quote.theme.toUpperCase()}
            </span>
          </div>

          {/* Reflection box emphasizing Ikhlas */}
          <div className="p-3.5 rounded-2xl bg-emerald-950/70 border border-emerald-700/50 text-xs text-emerald-100 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="text-amber-200">Renungan Keikhlasan: </strong>
              {quote.reflection}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-2 border-t border-emerald-800/70 text-xs">
            <button
              onClick={() => handleCopy(`"${quote.arabic}"\n\n"${quote.translation}"\n- ${quote.source}\n\nRenungan: ${quote.reflection}`, 'quote')}
              className="flex items-center gap-1.5 text-emerald-300 hover:text-white transition cursor-pointer"
            >
              {copiedKey === 'quote' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-amber-400 font-bold">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Pesan Motivasi</span>
                </>
              )}
            </button>

            <button
              onClick={handleTestNotification}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-emerald-950 font-bold transition cursor-pointer shadow-xs"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Kirim Pengingat Uji Coba</span>
            </button>
          </div>

          {notificationTestStatus && (
            <div className="p-2.5 rounded-xl bg-amber-400/20 border border-amber-400/40 text-xs text-amber-200 animate-fadeIn text-center">
              🔔 {notificationTestStatus}
            </div>
          )}
        </div>
      </div>

      {/* Doa Sebelum & Sesudah Tilawah */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Doa Sebelum */}
        <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-600" />
              <span>{DUAS_QURAN.beforeTilawah.title}</span>
            </h3>
            <button
              onClick={() => handleCopy(`${DUAS_QURAN.beforeTilawah.arabic}\n\n${DUAS_QURAN.beforeTilawah.latin}\n\nArtinya: ${DUAS_QURAN.beforeTilawah.meaning}`, 'doa-before')}
              className="p-1.5 text-stone-400 hover:text-emerald-700 rounded-lg hover:bg-stone-100 transition cursor-pointer"
              title="Salin Doa"
            >
              {copiedKey === 'doa-before' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <p className="font-arabic text-xl text-stone-900 text-right leading-relaxed dir-rtl">
            {DUAS_QURAN.beforeTilawah.arabic}
          </p>

          <p className="text-xs italic text-stone-600">
            "{DUAS_QURAN.beforeTilawah.latin}"
          </p>

          <p className="text-xs text-stone-500 pt-2 border-t border-stone-100">
            <strong>Artinya:</strong> {DUAS_QURAN.beforeTilawah.meaning}
          </p>
        </div>

        {/* Doa Setelah */}
        <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>{DUAS_QURAN.afterTilawah.title}</span>
            </h3>
            <button
              onClick={() => handleCopy(`${DUAS_QURAN.afterTilawah.arabic}\n\n${DUAS_QURAN.afterTilawah.latin}\n\nArtinya: ${DUAS_QURAN.afterTilawah.meaning}`, 'doa-after')}
              className="p-1.5 text-stone-400 hover:text-emerald-700 rounded-lg hover:bg-stone-100 transition cursor-pointer"
              title="Salin Doa"
            >
              {copiedKey === 'doa-after' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <p className="font-arabic text-xl text-stone-900 text-right leading-relaxed dir-rtl">
            {DUAS_QURAN.afterTilawah.arabic}
          </p>

          <p className="text-xs italic text-stone-600">
            "{DUAS_QURAN.afterTilawah.latin}"
          </p>

          <p className="text-xs text-stone-500 pt-2 border-t border-stone-100">
            <strong>Artinya:</strong> {DUAS_QURAN.afterTilawah.meaning}
          </p>
        </div>
      </div>
    </div>
  );
};
