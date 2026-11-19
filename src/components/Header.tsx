import React from 'react';
import {
  BookOpen,
  Calendar,
  AlertCircle,
  Sparkles,
  Smartphone,
  Monitor,
  Bell,
  Volume2,
  VolumeX,
  Database,
  Printer,
  HardDrive,
  LogIn,
  LogOut,
  Cloud,
  Check
} from 'lucide-react';
import { User } from '../lib/firebase';

interface HeaderProps {
  activeTab: 'tracker' | 'mushaf' | 'calendar' | 'debt' | 'motivation' | 'report' | 'architecture';
  setActiveTab: (tab: 'tracker' | 'mushaf' | 'calendar' | 'debt' | 'motivation' | 'report' | 'architecture') => void;
  totalDebt: number;
  streak: number;
  soundEnabled: boolean;
  toggleSound: () => void;
  isMobileDeviceView: boolean;
  toggleDeviceView: () => void;
  onOpenNotifications: () => void;
  onOpenBackup: () => void;
  currentUser: User | null;
  onLogin: () => void;
  onLogout: () => void;
  isSyncing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  totalDebt,
  streak,
  soundEnabled,
  toggleSound,
  isMobileDeviceView,
  toggleDeviceView,
  onOpenNotifications,
  onOpenBackup,
  currentUser,
  onLogin,
  onLogout,
  isSyncing
}) => {
  return (
    <header className="no-print bg-emerald-900 text-white sticky top-0 z-30 shadow-md border-b border-emerald-800">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg text-emerald-950 font-bold shrink-0">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-950" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-lg font-bold tracking-tight text-white truncate">
                  Mutaba'ah Qur'an
                </h1>
                <span className="text-[9px] sm:text-[10px] uppercase font-semibold px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 whitespace-nowrap">
                  1446H
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-emerald-200 hidden sm:block truncate">
                Pelacak Progres Tilawah Harian & Penjaga Istiqomah Ibadah
              </p>
            </div>
          </div>

          {/* Quick Stats & Controls */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Streak Counter */}
            <div className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-emerald-800/80 border border-emerald-700/60 text-xs text-amber-300" title="Hari berturut-turut membaca">
              <span>🔥</span>
              <span className="font-bold">{streak}</span>
              <span className="hidden md:inline text-emerald-200">hari</span>
            </div>

            {/* Debt Indicator Badge if > 0 */}
            {totalDebt > 0 && (
              <button
                onClick={() => setActiveTab('debt')}
                className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 text-xs font-medium transition cursor-pointer"
                title="Ada sisa utang halaman yang perlu diqadha"
              >
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span className="hidden sm:inline">Utang: </span>
                <strong className="text-white">{totalDebt}</strong>
                <span className="hidden xs:inline"> hal</span>
              </button>
            )}

            {/* Backup & Restore JSON button */}
            <button
              onClick={onOpenBackup}
              className="p-1.5 sm:p-2 rounded-lg bg-emerald-800/60 hover:bg-emerald-700 text-emerald-200 hover:text-white transition cursor-pointer flex items-center gap-1"
              title="Backup & Restore Data (Ekspor/Impor JSON)"
              aria-label="Backup dan Restore Data"
            >
              <HardDrive className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300" />
              <span className="text-xs hidden lg:inline text-emerald-100 font-semibold">Backup</span>
            </button>

            {/* Notification Reminder button */}
            <button
              onClick={onOpenNotifications}
              className="p-1.5 sm:p-2 rounded-lg bg-emerald-800/60 hover:bg-emerald-700 text-emerald-200 hover:text-white transition cursor-pointer"
              title="Pengaturan Pengingat & Notifikasi Harian"
              aria-label="Pengaturan Pengingat"
            >
              <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* Sound Toggle */}
            <button
              onClick={toggleSound}
              className="p-1.5 sm:p-2 rounded-lg bg-emerald-800/60 hover:bg-emerald-700 text-emerald-200 hover:text-white transition cursor-pointer"
              title={soundEnabled ? 'Matikan Suara Chime' : 'Nyalakan Suara Chime'}
              aria-label="Toggle Sound"
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-300" /> : <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400/60" />}
            </button>

            {/* Toggle Mobile Phone Mockup vs Fluid Wide View */}
            <button
              onClick={toggleDeviceView}
              className={`p-1.5 sm:p-2 rounded-lg transition cursor-pointer flex items-center gap-1 text-xs font-semibold ${
                isMobileDeviceView
                  ? 'bg-amber-400 text-emerald-950 font-bold shadow-xs'
                  : 'bg-emerald-800/60 hover:bg-emerald-700 text-emerald-200 hover:text-white'
              }`}
              title={isMobileDeviceView ? 'Beralih ke Tampilan Lebar' : 'Beralih ke Mode HP (Simulasi Smartphone)'}
            >
              {isMobileDeviceView ? (
                <>
                  <Monitor className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Layar Lebar</span>
                </>
              ) : (
                <>
                  <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300" />
                  <span className="hidden sm:inline">Mode HP</span>
                </>
              )}
            </button>

            {/* Firebase Google Auth & Cloud Sync Button */}
            {currentUser ? (
              <div className="flex items-center gap-1.5 pl-1 border-l border-emerald-700/60">
                <div
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-800/80 border border-emerald-600/50 text-xs text-emerald-100"
                  title={`Tersinkron ke Firebase Cloud sebagai: ${currentUser.displayName || currentUser.email}`}
                >
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.displayName || 'User'}
                      className="w-5 h-5 rounded-full border border-amber-400/60 object-cover"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-amber-400 text-emerald-950 font-bold flex items-center justify-center text-[10px]">
                      {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="hidden md:flex flex-col text-left leading-tight">
                    <span className="font-semibold text-white max-w-[90px] truncate text-[11px]">
                      {currentUser.displayName?.split(' ')[0] || 'Tersambung'}
                    </span>
                    <span className="text-[9px] text-emerald-300 flex items-center gap-0.5">
                      <Cloud className="w-2.5 h-2.5 text-amber-300" />
                      {isSyncing ? 'Menyinkron...' : 'Cloud Aktif'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={onLogout}
                  className="p-1.5 rounded-lg bg-emerald-800/60 hover:bg-red-900/60 text-emerald-200 hover:text-red-200 transition cursor-pointer"
                  title="Keluar dari Akun Google"
                  aria-label="Logout"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={onLogin}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-emerald-950 font-bold text-xs shadow-sm transition cursor-pointer"
                title="Masuk dengan Akun Google untuk sinkronisasi otomatis antar perangkat"
              >
                <LogIn className="w-3.5 h-3.5 text-emerald-950" />
                <span className="hidden xs:inline">Masuk Google</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2 mt-3 overflow-x-auto no-scrollbar pt-1 border-t border-emerald-800/80">
          <button
            onClick={() => setActiveTab('tracker')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              activeTab === 'tracker'
                ? 'bg-amber-400 text-emerald-950 shadow-sm'
                : 'text-emerald-200 hover:bg-emerald-800 hover:text-white'
            }`}
          >
            <span>Progres Harian</span>
          </button>

          <button
            onClick={() => setActiveTab('mushaf')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              activeTab === 'mushaf'
                ? 'bg-amber-400 text-emerald-950 shadow-sm'
                : 'text-emerald-200 hover:bg-emerald-800 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Al-Qur'an Madinah</span>
            <span className="text-[10px] bg-emerald-950/70 text-amber-300 px-1.5 py-0.2 rounded font-mono font-bold">604 Hal</span>
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              activeTab === 'calendar'
                ? 'bg-amber-400 text-emerald-950 shadow-sm'
                : 'text-emerald-200 hover:bg-emerald-800 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Kalender Khatam</span>
          </button>

          <button
            onClick={() => setActiveTab('debt')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer relative ${
              activeTab === 'debt'
                ? 'bg-amber-400 text-emerald-950 shadow-sm'
                : 'text-emerald-200 hover:bg-emerald-800 hover:text-white'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Pelacak Utang</span>
            {totalDebt > 0 && (
              <span className={`w-2 h-2 rounded-full ${activeTab === 'debt' ? 'bg-red-600' : 'bg-amber-400'}`} />
            )}
          </button>

          <button
            onClick={() => setActiveTab('report')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer relative ${
              activeTab === 'report'
                ? 'bg-amber-400 text-emerald-950 shadow-sm'
                : 'text-emerald-200 hover:bg-emerald-800 hover:text-white'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Resi & Laporan</span>
          </button>

          <button
            onClick={() => setActiveTab('motivation')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              activeTab === 'motivation'
                ? 'bg-amber-400 text-emerald-950 shadow-sm'
                : 'text-emerald-200 hover:bg-emerald-800 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Motivasi & Doa</span>
          </button>

          <button
            onClick={() => setActiveTab('architecture')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ml-auto ${
              activeTab === 'architecture'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-emerald-800/80 text-emerald-100 hover:bg-emerald-700'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-amber-300" />
            <span className="font-bold">Kode Room DB Android</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
