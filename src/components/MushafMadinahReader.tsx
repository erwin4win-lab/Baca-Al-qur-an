import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  CheckCircle2,
  Check,
  Volume2,
  VolumeX,
  Sparkles,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sun,
  Moon,
  Info,
  Play,
  Pause,
  Search,
  X
} from 'lucide-react';
import { SURAH_LIST } from '../data/surahData';
import { JUZ_LIST, getJuzForPage, getMadinahPageImageUrl } from '../data/mushafData';
import { soundManager } from '../utils/audioNotification';
import { clampNumber } from '../utils/sanitize';

interface AyahItem {
  number: number;
  text: string;
  translation?: string;
  numberInSurah: number;
  surah: {
    number: number;
    name: string;
    englishName: string;
  };
}

interface MushafMadinahReaderProps {
  initialPage?: number;
  lastReadPage: number;
  onSaveBookmark: (surah: string, ayat: number, page: number) => void;
  onAddPageProgress: (pagesToAdd: number) => void;
  todayCompletedPages: number;
  todayTargetPages: number;
  soundEnabled: boolean;
}

export const MushafMadinahReader: React.FC<MushafMadinahReaderProps> = ({
  initialPage = 1,
  lastReadPage,
  onSaveBookmark,
  onAddPageProgress,
  todayCompletedPages,
  todayTargetPages,
  soundEnabled
}) => {
  const [currentPage, setCurrentPage] = useState<number>(() => clampNumber(initialPage, 1, 604, 1));
  const [viewMode, setViewMode] = useState<'mushaf' | 'text'>('mushaf');
  const [themeMode, setThemeMode] = useState<'cream' | 'dark' | 'white'>('cream');
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Digital text states
  const [pageAyahs, setPageAyahs] = useState<AyahItem[]>([]);
  const [textLoading, setTextLoading] = useState(false);
  const [activePlayingAyah, setActivePlayingAyah] = useState<number | null>(null);

  // Bookmarking feedback
  const [bookmarkSaved, setBookmarkSaved] = useState(false);
  const [progressAdded, setProgressAdded] = useState(false);

  // Audio player, network abort, and timer refs for memory-leak prevention
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const bookmarkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (fetchAbortRef.current) {
        fetchAbortRef.current.abort();
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      if (bookmarkTimerRef.current) clearTimeout(bookmarkTimerRef.current);
      if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    };
  }, []);

  const currentJuz = getJuzForPage(currentPage);

  // Surah Search & Modal States
  const [isSurahModalOpen, setIsSurahModalOpen] = useState(false);
  const [surahSearchQuery, setSurahSearchQuery] = useState('');
  const [surahFilterTab, setSurahFilterTab] = useState<'all' | 'juz30' | 'makkiyah' | 'madaniyah'>('all');

  // Track currently selected surah with fallback to current page
  const [selectedSurahNumber, setSelectedSurahNumber] = useState<number>(() => {
    const matched = [...SURAH_LIST]
      .filter((s) => s.startPage <= initialPage)
      .sort((a, b) => b.startPage - a.startPage || a.number - b.number)[0];
    return matched ? matched.number : 1;
  });

  // When currentPage changes, check if current selectedSurah still belongs on this page
  useEffect(() => {
    const cur = SURAH_LIST.find((s) => s.number === selectedSurahNumber);
    if (cur) {
      const next = SURAH_LIST.find((s) => s.number === selectedSurahNumber + 1);
      const endPage = next ? (next.startPage === cur.startPage ? cur.startPage : next.startPage) : 604;
      if (currentPage >= cur.startPage && currentPage <= endPage) {
        return;
      }
    }
    const matched = [...SURAH_LIST]
      .filter((s) => s.startPage <= currentPage)
      .sort((a, b) => b.startPage - a.startPage || a.number - b.number)[0];
    if (matched) {
      setSelectedSurahNumber(matched.number);
    }
  }, [currentPage, selectedSurahNumber]);

  const currentSurah = SURAH_LIST.find((s) => s.number === selectedSurahNumber) || SURAH_LIST[0];

  const handleSelectSurah = (surahNum: number) => {
    const targetSurah = SURAH_LIST.find((s) => s.number === surahNum);
    if (targetSurah) {
      if (soundEnabled) soundManager.playTap();
      setSelectedSurahNumber(targetSurah.number);
      setCurrentPage(targetSurah.startPage);
      setIsSurahModalOpen(false);
    }
  };

  const filteredSurahs = SURAH_LIST.filter((s) => {
    if (surahFilterTab === 'juz30' && s.juz !== 30) return false;
    if (surahFilterTab === 'makkiyah' && s.revelation !== 'Makkiyah') return false;
    if (surahFilterTab === 'madaniyah' && s.revelation !== 'Madaniyah') return false;

    if (!surahSearchQuery.trim()) return true;
    const q = surahSearchQuery.toLowerCase().trim();
    return (
      s.name.toLowerCase().includes(q) ||
      s.arabicName.includes(q) ||
      s.number.toString() === q ||
      s.startPage.toString() === q
    );
  });

  // Sync initialPage changes if passed from props
  useEffect(() => {
    if (initialPage && initialPage >= 1 && initialPage <= 604) {
      setCurrentPage(initialPage);
    }
  }, [initialPage]);

  // Handle page turn resets
  useEffect(() => {
    setImageLoading(true);
    setImageError(false);

    if (audioRef.current) {
      audioRef.current.pause();
      setActivePlayingAyah(null);
    }

    if (viewMode === 'text') {
      fetchPageText(currentPage);
    }

    return () => {
      if (fetchAbortRef.current) {
        fetchAbortRef.current.abort();
      }
    };
  }, [currentPage, viewMode]);

  const fetchPageText = async (pageNum: number) => {
    const safePage = clampNumber(pageNum, 1, 604, 1);

    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort();
    }
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    const timeoutId = setTimeout(() => controller.abort(), 12000);
    setTextLoading(true);

    try {
      const [resText, resTrans] = await Promise.all([
        fetch(`https://api.alquran.cloud/v1/page/${safePage}/quran-uthmani`, { signal: controller.signal }),
        fetch(`https://api.alquran.cloud/v1/page/${safePage}/id.indonesian`, { signal: controller.signal })
      ]);

      if (!resText.ok) {
        throw new Error(`HTTP ${resText.status}`);
      }

      const dataText = await resText.json();
      const dataTrans = resTrans.ok ? await resTrans.json() : null;

      if (!controller.signal.aborted && dataText?.code === 200 && Array.isArray(dataText?.data?.ayahs)) {
        const translations = Array.isArray(dataTrans?.data?.ayahs) ? dataTrans.data.ayahs : [];
        const combined: AyahItem[] = dataText.data.ayahs.map((ayah: AyahItem, index: number) => ({
          ...ayah,
          translation: translations[index]?.text || ''
        }));
        setPageAyahs(combined);
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
      console.warn("Gagal memuat teks Al-Qur'an:", e);
    } finally {
      clearTimeout(timeoutId);
      if (!controller.signal.aborted) {
        setTextLoading(false);
      }
    }
  };

  const handleNextPage = () => {
    if (currentPage < 604) {
      if (soundEnabled) soundManager.playTap();
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      if (soundEnabled) soundManager.playTap();
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleSaveCurrentBookmark = () => {
    onSaveBookmark(currentSurah.name, 1, currentPage);
    setBookmarkSaved(true);
    if (soundEnabled) soundManager.playSuccess();
    if (bookmarkTimerRef.current) clearTimeout(bookmarkTimerRef.current);
    bookmarkTimerRef.current = setTimeout(() => setBookmarkSaved(false), 2500);
  };

  const handleMarkPageDone = (pagesToAdd = 1) => {
    onAddPageProgress(pagesToAdd);
    setProgressAdded(true);
    if (soundEnabled) soundManager.playSuccess();
    if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    progressTimerRef.current = setTimeout(() => setProgressAdded(false), 2500);
  };

  const handlePlayAudioAyah = (ayahGlobalNumber: number) => {
    const safeAyahNum = clampNumber(ayahGlobalNumber, 1, 6236, 1);
    if (activePlayingAyah === safeAyahNum) {
      audioRef.current?.pause();
      setActivePlayingAyah(null);
      return;
    }

    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      const audioUrl = `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${safeAyahNum}.mp3`;
      const newAudio = new Audio(audioUrl);
      audioRef.current = newAudio;
      setActivePlayingAyah(safeAyahNum);

      newAudio.play().catch(() => {
        setActivePlayingAyah(null);
      });

      newAudio.onended = () => {
        setActivePlayingAyah(null);
      };
      newAudio.onerror = () => {
        setActivePlayingAyah(null);
      };
    } catch {
      setActivePlayingAyah(null);
    }
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(220, prev + 20));
    if (soundEnabled) soundManager.playTap();
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(70, prev - 20));
    if (soundEnabled) soundManager.playTap();
  };

  const handleResetZoom = () => {
    setZoomLevel(100);
    if (soundEnabled) soundManager.playTap();
  };

  const handleToggleFit = () => {
    setZoomLevel((prev) => (prev === 100 ? 140 : 100));
    if (soundEnabled) soundManager.playTap();
  };

  // Keyboard navigation support (Arrow Left/Right for pages, +/-/0 for zoom)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') handleNextPage();
      if (e.key === 'ArrowRight') handlePrevPage();
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoomLevel((prev) => Math.min(220, prev + 20));
        if (soundEnabled) soundManager.playTap();
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setZoomLevel((prev) => Math.max(70, prev - 20));
        if (soundEnabled) soundManager.playTap();
      }
      if (e.key === '0') {
        e.preventDefault();
        setZoomLevel(100);
        if (soundEnabled) soundManager.playTap();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, soundEnabled]);

  // Page image URL
  const pageImgUrl = getMadinahPageImageUrl(currentPage);

  return (
    <div className="space-y-4">
      {/* Top Mushaf Navigation & Integration Header */}
      <div className="bg-gradient-to-br from-emerald-900 via-emerald-850 to-stone-900 text-white rounded-3xl p-3.5 sm:p-5 shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="p-1.5 rounded-lg bg-amber-400/20 text-amber-300 shrink-0">
                <BookOpen className="w-4 h-4 text-amber-300" />
              </span>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-300 truncate">
                Mushaf Al-Qur'an Standar Madinah
              </span>
            </div>

            <div className="flex items-baseline gap-2 flex-wrap">
              <h2 className="text-lg sm:text-2xl font-black text-white">
                Halaman {currentPage}
              </h2>
              <span className="text-xs text-emerald-200">/ 604 Hal</span>
              <span className="text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-800 border border-emerald-700 text-amber-300">
                Juz {currentJuz.juz} ({currentJuz.arabicName})
              </span>
            </div>

            <p className="text-[11px] sm:text-xs text-emerald-200/90 truncate">
              Surah {currentSurah.number}. {currentSurah.name} ({currentSurah.arabicName}) • {currentSurah.revelation}
            </p>
          </div>

          {/* Quick Progress Tracking Integration Actions */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
            {/* Bookmark button */}
            <button
              onClick={handleSaveCurrentBookmark}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                bookmarkSaved
                  ? 'bg-amber-400 text-emerald-950 border-amber-300 shadow-sm'
                  : 'bg-emerald-800/80 hover:bg-emerald-700 text-emerald-100 border-emerald-700'
              }`}
              title="Tandai halaman ini sebagai bacaan terakhir"
            >
              {bookmarkSaved ? <Check className="w-3.5 h-3.5 text-emerald-950" /> : <Bookmark className="w-3.5 h-3.5 text-amber-300" />}
              <span>{bookmarkSaved ? 'Ditandai!' : 'Penanda'}</span>
            </button>

            {/* Quick +1 or +4 pages progress button */}
            <button
              onClick={() => handleMarkPageDone(1)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-emerald-950 text-xs font-extrabold transition cursor-pointer shadow-sm"
              title="Catat 1 halaman ini ke progres tilawah harian Anda"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{progressAdded ? 'Tercatat!' : '+1 Hal Selesai'}</span>
            </button>
          </div>
        </div>

        {/* Reader Navigation & Selectors Row */}
        <div className="mt-3 pt-3 border-t border-emerald-800/80 flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-xs">
          {/* Quick Jump Selectors: 2-column grid on mobile */}
          <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
            {/* Juz Selector */}
            <div className="flex items-center gap-1.5 bg-emerald-950/80 px-2.5 py-1.5 rounded-xl border border-emerald-700/60 min-w-0">
              <span className="text-emerald-300 font-semibold shrink-0">Juz:</span>
              <select
                value={currentJuz.juz}
                onChange={(e) => {
                  const targetJuz = JUZ_LIST.find((j) => j.juz === parseInt(e.target.value));
                  if (targetJuz) setCurrentPage(targetJuz.startPage);
                }}
                className="bg-transparent text-white font-bold focus:outline-none cursor-pointer text-xs w-full truncate"
              >
                {JUZ_LIST.map((j) => (
                  <option key={j.juz} value={j.juz} className="text-stone-900">
                    Juz {j.juz} - {j.name} (Hal {j.startPage})
                  </option>
                ))}
              </select>
            </div>

            {/* Surah Selector (Lengkap 114 Surah + Tombol Modal Pencarian) */}
            <div className="flex items-center gap-1.5 bg-emerald-950/80 px-2 py-1 rounded-xl border border-emerald-700/60 min-w-0">
              <span className="text-emerald-300 font-semibold shrink-0 text-xs pl-1">Surah:</span>
              <select
                value={currentSurah.number}
                onChange={(e) => handleSelectSurah(parseInt(e.target.value, 10))}
                className="bg-transparent text-white font-bold focus:outline-none cursor-pointer text-xs w-full truncate py-0.5"
                title="Pilih Surah (1 - 114)"
              >
                {SURAH_LIST.map((s) => (
                  <option key={s.number} value={s.number} className="text-stone-900">
                    {s.number}. {s.name} ({s.arabicName}) - Hal {s.startPage}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setIsSurahModalOpen(true)}
                className="p-1.5 rounded-lg bg-emerald-800/90 hover:bg-emerald-700 text-amber-300 hover:text-white transition cursor-pointer shrink-0"
                title="Buka Daftar Lengkap & Cari dari 114 Surah"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* View Mode, Zoom Controls & Theme Switchers */}
          <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 flex-wrap">
            {/* Zoom In & Zoom Out Controls */}
            <div className="flex items-center bg-emerald-950/80 p-0.5 rounded-xl border border-emerald-700/60 shadow-xs">
              <button
                onClick={handleZoomOut}
                disabled={zoomLevel <= 70}
                className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800 disabled:opacity-30 transition cursor-pointer"
                title="Perkecil Halaman (Zoom Out) [-]"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleResetZoom}
                className="px-2 py-1 text-[11px] font-mono font-bold text-amber-300 hover:text-white hover:bg-emerald-800 rounded-lg transition cursor-pointer"
                title="Klik untuk Reset Zoom (100%) [0]"
              >
                {zoomLevel}%
              </button>
              <button
                onClick={handleZoomIn}
                disabled={zoomLevel >= 220}
                className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800 disabled:opacity-30 transition cursor-pointer"
                title="Perbesar Halaman (Zoom In) [+]"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Mode: Lembaran Mushaf vs Teks Ayat */}
            <div className="flex bg-emerald-950/80 p-0.5 rounded-xl border border-emerald-700/60">
              <button
                onClick={() => setViewMode('mushaf')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'mushaf'
                    ? 'bg-amber-400 text-emerald-950'
                    : 'text-emerald-200 hover:text-white'
                }`}
              >
                Lembaran Asli
              </button>
              <button
                onClick={() => setViewMode('text')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'text'
                    ? 'bg-amber-400 text-emerald-950'
                    : 'text-emerald-200 hover:text-white'
                }`}
              >
                Teks & Terjemahan
              </button>
            </div>

            {/* Background theme toggle for reader */}
            <div className="flex items-center bg-emerald-950/80 p-1 rounded-xl border border-emerald-700/60 gap-1">
              <button
                onClick={() => setThemeMode('cream')}
                className={`w-5 h-5 rounded-md transition cursor-pointer bg-[#fbf7ee] border ${
                  themeMode === 'cream' ? 'ring-2 ring-amber-400' : 'opacity-60'
                }`}
                title="Kertas Mushaf Krem Alami"
              />
              <button
                onClick={() => setThemeMode('white')}
                className={`w-5 h-5 rounded-md transition cursor-pointer bg-white border ${
                  themeMode === 'white' ? 'ring-2 ring-amber-400' : 'opacity-60'
                }`}
                title="Latar Putih Bersih"
              />
              <button
                onClick={() => setThemeMode('dark')}
                className={`w-5 h-5 rounded-md transition cursor-pointer bg-stone-900 border ${
                  themeMode === 'dark' ? 'ring-2 ring-amber-400' : 'opacity-60'
                }`}
                title="Mode Gelap Malam"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Reader Stage */}
      <div
        className={`rounded-3xl border shadow-sm transition-colors overflow-hidden min-h-[580px] flex flex-col justify-between relative ${
          themeMode === 'cream'
            ? 'bg-[#f8f4e9] border-[#e8dfc8]'
            : themeMode === 'dark'
            ? 'bg-stone-950 border-stone-800 text-stone-100'
            : 'bg-white border-stone-200'
        }`}
      >
        {/* Floating Quick Zoom Overlay Button Pill (Hanya untuk desktop/tablet agar di ponsel tidak menutupi tulisan suci Al-Qur'an) */}
        <div className="hidden sm:flex absolute top-3 right-3 z-30 items-center gap-1 bg-stone-900/85 backdrop-blur-md text-white px-2 py-1 rounded-2xl border border-white/20 shadow-md">
          <button
            onClick={handleZoomOut}
            disabled={zoomLevel <= 70}
            className="p-1 rounded-lg hover:bg-white/20 disabled:opacity-30 transition cursor-pointer"
            title="Perkecil Halaman (Zoom Out) [-]"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleToggleFit}
            className="px-1.5 py-0.5 text-[11px] font-mono font-bold text-amber-300 hover:bg-white/20 rounded-md transition cursor-pointer"
            title="Klik untuk Ubah Skala Zoom (100% ↔ 140%)"
          >
            {zoomLevel}%
          </button>
          <button
            onClick={handleZoomIn}
            disabled={zoomLevel >= 220}
            className="p-1 rounded-lg hover:bg-white/20 disabled:opacity-30 transition cursor-pointer"
            title="Perbesar Halaman (Zoom In) [+]"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          {zoomLevel !== 100 && (
            <button
              onClick={handleResetZoom}
              className="p-1 rounded-lg text-emerald-400 hover:bg-white/20 transition cursor-pointer ml-0.5"
              title="Reset ke Ukuran Normal 100% [0]"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* VIEW MODE 1: LEMBARAN MUSHAF MADINAH ASLI */}
        {viewMode === 'mushaf' && (
          <div className="flex-1 flex flex-col items-center justify-center p-1 sm:p-3 relative overflow-auto max-h-[68vh] sm:max-h-[80vh] w-full">
            {/* Loading Indicator */}
            {imageLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-inherit z-10 space-y-3">
                <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-stone-500 font-medium">
                  Memuat lembaran Mushaf Madinah halaman {currentPage}...
                </span>
              </div>
            )}

            {/* High-Resolution Madinah Page Image with Zoom Scale and Double-Click Toggle */}
            <div
              className="relative flex items-center justify-center transition-transform duration-200 origin-top cursor-zoom-in w-full"
              style={{
                transform: `scale(${zoomLevel / 100})`,
                width: zoomLevel > 100 ? `${zoomLevel}%` : '100%',
                maxWidth: zoomLevel > 100 ? 'none' : '36rem'
              }}
              onDoubleClick={handleToggleFit}
              title="Klik dua kali untuk perbesar / kembalikan ke normal"
            >
              <img
                src={pageImgUrl}
                alt={`Mushaf Madinah Halaman ${currentPage}`}
                onLoad={() => setImageLoading(false)}
                onError={() => {
                  setImageLoading(false);
                  setImageError(true);
                }}
                className={`max-h-[64vh] sm:max-h-[78vh] w-auto max-w-full object-contain mx-auto transition-opacity duration-300 select-none shadow-sm rounded-lg ${
                  imageLoading ? 'opacity-0' : 'opacity-100'
                } ${themeMode === 'dark' ? 'invert hue-rotate-180 brightness-95 contrast-125' : ''}`}
                draggable={false}
              />
            </div>

            {/* Offline Fallback if image fails */}
            {imageError && (
              <div className="p-6 text-center space-y-3 max-w-md mx-auto">
                <Info className="w-8 h-8 text-amber-600 mx-auto" />
                <h4 className="text-sm font-bold text-stone-900">
                  Gagal Memuat Lembaran Halaman {currentPage}
                </h4>
                <p className="text-xs text-stone-500">
                  Koneksi CDN gambar sedang sibuk atau offline. Beralih ke mode Teks Ayat & Terjemahan untuk tetap membaca dengan lancar.
                </p>
                <button
                  onClick={() => setViewMode('text')}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition cursor-pointer"
                >
                  Buka Mode Teks Ayat
                </button>
              </div>
            )}
          </div>
        )}

        {/* VIEW MODE 2: TEKS AYAT RASM UTHMANI & TERJEMAHAN KEMENAG */}
        {viewMode === 'text' && (
          <div
            className="flex-1 p-3.5 sm:p-6 overflow-y-auto max-h-[68vh] sm:max-h-[75vh] space-y-4 transition-all duration-200"
            style={{ fontSize: `${(zoomLevel / 100) * 100}%` }}
          >
            {textLoading ? (
              <div className="py-20 text-center space-y-3">
                <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-stone-500">
                  Mengambil teks Rasm Uthmani & terjemahan halaman {currentPage}...
                </p>
              </div>
            ) : pageAyahs.length > 0 ? (
              <div className="space-y-4 divide-y divide-stone-200/60">
                {pageAyahs.map((ayah) => {
                  const isPlaying = activePlayingAyah === ayah.number;
                  return (
                    <div key={ayah.number} className="pt-4 space-y-3">
                      {/* Surah Header if verse is 1 */}
                      {ayah.numberInSurah === 1 && (
                        <div className="text-center py-2.5 bg-emerald-100/60 rounded-2xl border border-emerald-200/80 mb-3">
                          <span className="font-arabic text-xl font-bold text-emerald-950 block">
                            {ayah.surah.name}
                          </span>
                          <span className="text-xs text-emerald-800 font-semibold">
                            Surah ke-{ayah.surah.number} ({ayah.surah.englishName})
                          </span>
                        </div>
                      )}

                      {/* Arabic Verse Text */}
                      <div className="flex items-start justify-between gap-3">
                        <button
                          onClick={() => handlePlayAudioAyah(ayah.number)}
                          className={`p-2 rounded-xl border transition cursor-pointer shrink-0 mt-1 ${
                            isPlaying
                              ? 'bg-amber-400 border-amber-500 text-emerald-950'
                              : 'bg-stone-100 hover:bg-stone-200 text-stone-600 border-stone-200'
                          }`}
                          title={isPlaying ? 'Jeda Audio' : 'Dengarkan Tilawah Misyari Rasyid'}
                        >
                          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </button>

                        <p className="font-arabic text-xl sm:text-3xl text-right leading-[2.2] sm:leading-[2.4] text-stone-900 dir-rtl flex-1">
                          {ayah.text}{' '}
                          <span className="font-arabic text-xs sm:text-sm text-emerald-700 border border-emerald-400 rounded-full w-6 h-6 sm:w-7 sm:h-7 inline-flex items-center justify-center align-middle mx-1 font-mono">
                            {ayah.numberInSurah}
                          </span>
                        </p>
                      </div>

                      {/* Indonesian Translation */}
                      {ayah.translation && (
                        <p className="text-xs text-stone-600 pl-9 sm:pl-11 leading-relaxed">
                          <strong className="text-emerald-800">{ayah.numberInSurah}. </strong>
                          {ayah.translation}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center space-y-2">
                <Info className="w-8 h-8 text-stone-400 mx-auto" />
                <p className="text-xs text-stone-500">
                  Teks ayat sedang tidak tersedia secara offline. Silakan gunakan mode Lembaran Asli.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Bottom Pagination & Quick Navigation Bar */}
        <div
          className={`p-2.5 sm:p-4 border-t flex flex-col gap-2.5 ${
            themeMode === 'cream'
              ? 'bg-[#f4efe2] border-[#e5dcbf]'
              : themeMode === 'dark'
              ? 'bg-stone-900 border-stone-800 text-white'
              : 'bg-stone-50 border-stone-200'
          }`}
        >
          {/* Dedicated Zoom Toolbar for Mobile (Posisi rapi di panel kontrol bawah, 100% tidak menutupi tulisan Al-Qur'an) */}
          <div className="flex sm:hidden items-center justify-between px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 border border-stone-200/80 dark:border-stone-700/80">
            <span className="text-[11px] font-bold text-stone-600 dark:text-stone-300 flex items-center gap-1">
              <ZoomIn className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Zoom Mushaf:
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleZoomOut}
                disabled={zoomLevel <= 70}
                className="p-1.5 rounded-lg bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 disabled:opacity-30 border border-stone-300 dark:border-stone-700 shadow-2xs transition active:scale-95 cursor-pointer"
                title="Perkecil Halaman (Zoom Out)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleToggleFit}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-stone-800 text-emerald-700 dark:text-emerald-400 border border-stone-300 dark:border-stone-700 shadow-2xs font-mono font-bold text-xs active:scale-95 transition cursor-pointer"
                title="Klik untuk ubah skala zoom"
              >
                {zoomLevel}%
              </button>
              <button
                onClick={handleZoomIn}
                disabled={zoomLevel >= 220}
                className="p-1.5 rounded-lg bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 disabled:opacity-30 border border-stone-300 dark:border-stone-700 shadow-2xs transition active:scale-95 cursor-pointer"
                title="Perbesar Halaman (Zoom In)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              {zoomLevel !== 100 && (
                <button
                  onClick={handleResetZoom}
                  className="px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-2xs text-[11px] font-bold flex items-center gap-1 active:scale-95 transition cursor-pointer"
                  title="Kembalikan ke Ukuran Normal 100%"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>100%</span>
                </button>
              )}
            </div>
          </div>

          {/* Pagination Controls Row */}
          <div className="flex items-center justify-between gap-2">
            {/* Previous Page Button */}
            <button
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 disabled:opacity-40 text-stone-800 dark:text-stone-200 font-bold text-xs border border-stone-200 dark:border-stone-700 transition cursor-pointer shadow-xs shrink-0"
              title="Halaman Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Halaman Sebelumnya</span>
              <span className="sm:hidden text-[11px]">Sebelum</span>
            </button>

            {/* Direct Page Input & Slider */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <input
                type="number"
                min="1"
                max="604"
                value={currentPage}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 1 && val <= 604) {
                    setCurrentPage(val);
                  }
                }}
                className="w-12 sm:w-14 text-center text-xs font-bold py-1.5 px-1 rounded-xl bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-xs text-stone-500 font-medium">/ 604</span>

              {/* Quick zoom controls in footer (Desktop/Tablet) */}
              <div className="hidden sm:flex items-center gap-0.5 ml-1 border-l border-stone-300 dark:border-stone-700 pl-2">
                <button
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 70}
                  className="p-1 rounded-lg text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 disabled:opacity-30 transition cursor-pointer"
                  title="Perkecil Halaman [-]"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleToggleFit}
                  className="px-1.5 py-0.5 text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400 hover:bg-stone-200 dark:hover:bg-stone-700 rounded transition cursor-pointer"
                  title="Klik untuk ubah zoom (100% ↔ 140%)"
                >
                  {zoomLevel}%
                </button>
                <button
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= 220}
                  className="p-1 rounded-lg text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 disabled:opacity-30 transition cursor-pointer"
                  title="Perbesar Halaman [+]"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                {zoomLevel !== 100 && (
                  <button
                    onClick={handleResetZoom}
                    className="p-1 rounded-lg text-emerald-600 hover:text-emerald-800 dark:hover:text-emerald-300 transition cursor-pointer ml-0.5"
                    title="Reset ke 100%"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Next Page Button */}
            <button
              onClick={handleNextPage}
              disabled={currentPage >= 604}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 disabled:opacity-40 text-stone-800 dark:text-stone-200 font-bold text-xs border border-stone-200 dark:border-stone-700 transition cursor-pointer shadow-xs shrink-0"
              title="Halaman Berikutnya"
            >
              <span className="hidden sm:inline">Halaman Berikutnya</span>
              <span className="sm:hidden text-[11px]">Berikut</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Daftar & Pencarian 114 Surah Lengkap */}
      {isSurahModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-stone-100 dark:border-stone-800 bg-gradient-to-r from-emerald-800 to-teal-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-700/60 rounded-xl">
                  <BookOpen className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg">Daftar 114 Surah Al-Qur'an</h3>
                  <p className="text-xs text-emerald-200">Pilih surah untuk langsung menuju halaman Mushaf Madinah</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSurahModalOpen(false)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition cursor-pointer text-white"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search & Filter Toolbar */}
            <div className="p-3 sm:p-4 border-b border-stone-100 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-900/70 space-y-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={surahSearchQuery}
                  onChange={(e) => setSurahSearchQuery(e.target.value)}
                  placeholder="Cari surah (misal: Kahf, Yasin, Rahman, 55, juz 30)..."
                  className="w-full pl-10 pr-9 py-2 rounded-xl text-xs sm:text-sm bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                  autoFocus
                />
                {surahSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setSurahSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSurahFilterTab('all')}
                  className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                    surahFilterTab === 'all'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-300'
                  }`}
                >
                  Semua (114)
                </button>
                <button
                  type="button"
                  onClick={() => setSurahFilterTab('juz30')}
                  className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                    surahFilterTab === 'juz30'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-300'
                  }`}
                >
                  Juz 30 (37 Surah)
                </button>
                <button
                  type="button"
                  onClick={() => setSurahFilterTab('makkiyah')}
                  className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                    surahFilterTab === 'makkiyah'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-300'
                  }`}
                >
                  Makkiyah (86)
                </button>
                <button
                  type="button"
                  onClick={() => setSurahFilterTab('madaniyah')}
                  className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                    surahFilterTab === 'madaniyah'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-300'
                  }`}
                >
                  Madaniyah (28)
                </button>
              </div>
            </div>

            {/* Surah List Grid */}
            <div className="p-3 sm:p-4 overflow-y-auto flex-1 divide-y divide-stone-100 dark:divide-stone-800">
              {filteredSurahs.length === 0 ? (
                <div className="text-center py-10 text-stone-400 space-y-2">
                  <p className="text-sm font-semibold">Surah tidak ditemukan</p>
                  <p className="text-xs">Coba kata kunci lain atau periksa ejaan nama surah.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filteredSurahs.map((surah) => {
                    const isCurrent = surah.number === currentSurah.number;
                    return (
                      <button
                        key={surah.number}
                        type="button"
                        onClick={() => handleSelectSurah(surah.number)}
                        className={`flex items-center justify-between p-2.5 rounded-2xl border text-left transition cursor-pointer ${
                          isCurrent
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 shadow-xs ring-1 ring-emerald-500'
                            : 'bg-white dark:bg-stone-800/80 border-stone-200 dark:border-stone-700/80 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-stone-50 dark:hover:bg-stone-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                              isCurrent
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-stone-100 dark:bg-stone-700 text-stone-700 dark:text-stone-200'
                            }`}
                          >
                            {surah.number}
                          </div>
                          <div className="truncate">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100 truncate">
                                {surah.name}
                              </span>
                              {isCurrent && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-600 text-white shrink-0">
                                  Sedang Dibaca
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-stone-500 dark:text-stone-400">
                              {surah.totalVerses} Ayat • {surah.revelation} • Juz {surah.juz}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0 pl-2">
                          <div className="font-arabic font-bold text-sm sm:text-base text-emerald-800 dark:text-emerald-300">
                            {surah.arabicName}
                          </div>
                          <div className="text-[10px] font-medium text-stone-500">
                            Hal {surah.startPage}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-stone-50 dark:bg-stone-900 border-t border-stone-100 dark:border-stone-800 text-center text-[11px] text-stone-500">
              Total 114 Surah (30 Juz) • Berdasarkan Mushaf Standar Madinah (604 Halaman)
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
