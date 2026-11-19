import React, { useState, useEffect, useRef } from 'react';
import { Bell, Clock, Check, X, Sparkles } from 'lucide-react';
import { PrayerTime, UserSettings } from '../types/quran';
import { PRAYER_METADATA } from '../utils/storage';
import { requestNotificationPermission, sendLocalNotification } from '../utils/audioNotification';

interface NotificationSettingsModalProps {
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  onClose: () => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  settings,
  onUpdateSettings,
  onClose
}) => {
  const [enabled, setEnabled] = useState(Boolean(settings?.remindersEnabled));
  const [times, setTimes] = useState<Record<PrayerTime, string>>(
    settings?.reminderTimes || {
      subuh: '05:00',
      dzuhur: '12:30',
      ashar: '15:45',
      maghrib: '18:25',
      isya: '19:45'
    }
  );
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleTimeChange = (prayer: PrayerTime, newTime: string) => {
    if (/^\d{2}:\d{2}$/.test(newTime)) {
      setTimes((prev) => ({ ...prev, [prayer]: newTime }));
    }
  };

  const handleSave = () => {
    onUpdateSettings({
      remindersEnabled: enabled,
      reminderTimes: times
    });
    onClose();
  };

  const handleTest = async () => {
    try {
      const granted = await requestNotificationPermission();
      sendLocalNotification(
        'Waktunya Tilawah Ramadhan 🌙',
        'Target 4 halaman usai shalat telah menanti. Niatkan semata-mata karena Allah Ta\'ala.'
      );
      setTestStatus(granted ? 'Notifikasi pengingat berhasil dikirim!' : 'Izin browser belum aktif, simulasi pesan dijalankan');

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setTestStatus(null), 3000);
    } catch (e) {
      console.warn('Gagal uji coba notifikasi:', e);
      setTestStatus('Simulasi notifikasi selesai.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
              <Bell className="w-5 h-5 text-emerald-700" />
            </span>
            <div>
              <h3 className="text-base font-bold text-stone-900">Jadwal Pengingat Tilawah</h3>
              <p className="text-xs text-stone-500">Notifikasi otomatis setelah waktu shalat fardhu</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Master Toggle */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 border border-stone-200">
            <div>
              <div className="text-xs font-bold text-stone-900">Aktifkan Notifikasi Harian</div>
              <div className="text-[11px] text-stone-500">Pemberitahuan ramah dengan kutipan motivasi ikhlas</div>
            </div>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                enabled ? 'bg-emerald-600' : 'bg-stone-300'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full bg-white shadow-md block transition-transform ${
                  enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Prayer Time Schedulers */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-stone-800">Waktu Pengingat Shalat:</div>
            {PRAYER_METADATA.map((p) => (
              <div
                key={p.key}
                className="flex items-center justify-between p-2.5 rounded-xl border border-stone-200 bg-white"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-800">{p.name}</span>
                  <span className="font-arabic text-xs text-emerald-800">{p.arabicName}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-stone-400" />
                  <input
                    type="time"
                    disabled={!enabled}
                    value={times[p.key] || p.defaultTime}
                    onChange={(e) => handleTimeChange(p.key, e.target.value)}
                    className="text-xs font-semibold px-2 py-1 rounded-lg border border-stone-300 bg-stone-50 disabled:opacity-50"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Test reminder button */}
          <div className="pt-2">
            <button
              onClick={handleTest}
              className="w-full py-2 px-3 text-xs font-bold rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Uji Coba Kirim Notifikasi Sekarang</span>
            </button>
            {testStatus && (
              <p className="text-[11px] text-center text-emerald-700 font-medium mt-1.5">
                ✓ {testStatus}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-200 flex items-center justify-end gap-2 bg-stone-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 transition cursor-pointer"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Simpan Jadwal</span>
          </button>
        </div>
      </div>
    </div>
  );
};
