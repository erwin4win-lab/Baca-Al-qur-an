import React, { useState } from 'react';
import { Search, X, Bookmark, Check } from 'lucide-react';
import { SURAH_LIST } from '../data/surahData';
import { SurahInfo } from '../types/quran';
import { clampNumber, sanitizeString } from '../utils/sanitize';

interface SurahBookmarkModalProps {
  currentSurah: string;
  currentAyat: number;
  currentPage: number;
  onSaveBookmark: (surah: string, ayat: number, page: number) => void;
  onClose: () => void;
}

export const SurahBookmarkModal: React.FC<SurahBookmarkModalProps> = ({
  currentSurah,
  currentAyat,
  currentPage,
  onSaveBookmark,
  onClose
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSurah, setSelectedSurah] = useState(currentSurah || 'Al-Baqarah');
  const [selectedAyat, setSelectedAyat] = useState(clampNumber(currentAyat, 1, 286, 1));
  const [selectedPage, setSelectedPage] = useState(clampNumber(currentPage, 1, 604, 2));

  // Find info of currently selected surah
  const activeSurahInfo = SURAH_LIST.find((s) => s.name === selectedSurah) || SURAH_LIST[1];
  const maxVerses = activeSurahInfo ? activeSurahInfo.totalVerses : 286;

  const cleanSearch = searchTerm.trim().toLowerCase();
  const filteredSurahs = SURAH_LIST.filter(
    (s) =>
      s.name.toLowerCase().includes(cleanSearch) ||
      s.arabicName.includes(cleanSearch) ||
      s.number.toString().includes(cleanSearch)
  );

  const handleSelectSurah = (surah: SurahInfo) => {
    setSelectedSurah(surah.name);
    setSelectedPage(clampNumber(surah.startPage, 1, 604, 1));
    setSelectedAyat(1);
  };

  const handleSave = () => {
    const finalAyat = clampNumber(selectedAyat, 1, maxVerses, 1);
    const finalPage = clampNumber(selectedPage, 1, 604, 1);
    const finalSurah = sanitizeString(selectedSurah, 50) || 'Al-Baqarah';

    onSaveBookmark(finalSurah, finalAyat, finalPage);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp">
        {/* Modal Header */}
        <div className="p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
              <Bookmark className="w-5 h-5 text-emerald-700" />
            </span>
            <div>
              <h3 className="text-base font-bold text-stone-900">Perbarui Penanda Bacaan (Bookmark)</h3>
              <p className="text-xs text-stone-500">Catat surah, ayat, dan halaman mushaf terakhir yang Anda baca</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected inputs preview */}
        <div className="p-4 bg-emerald-50/60 border-b border-emerald-100 grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] uppercase font-bold text-emerald-800">Surah</label>
            <div className="text-xs font-bold text-stone-900 truncate">{selectedSurah}</div>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-emerald-800">Ayat (1-{maxVerses})</label>
            <input
              type="number"
              min="1"
              max={maxVerses}
              value={selectedAyat}
              onChange={(e) => setSelectedAyat(clampNumber(e.target.value, 1, maxVerses, 1))}
              className="w-full text-xs font-bold px-2 py-1 rounded-lg bg-white border border-stone-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-emerald-800">Halaman (1-604)</label>
            <input
              type="number"
              min="1"
              max="604"
              value={selectedPage}
              onChange={(e) => setSelectedPage(clampNumber(e.target.value, 1, 604, 1))}
              className="w-full text-xs font-bold px-2 py-1 rounded-lg bg-white border border-stone-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Search Input */}
        <div className="p-3 border-b border-stone-100">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama surah (cth: Al-Baqarah, Yasin, Al-Mulk)..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-xl bg-stone-100 border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Surah List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 max-h-[320px]">
          {filteredSurahs.map((surah) => {
            const isSelected = selectedSurah === surah.name;
            return (
              <button
                key={surah.number}
                onClick={() => handleSelectSurah(surah)}
                className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                    : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center font-mono ${
                      isSelected ? 'bg-emerald-800 text-amber-300' : 'bg-stone-100 text-stone-700'
                    }`}
                  >
                    {surah.number}
                  </span>
                  <div>
                    <div className="text-xs font-bold">{surah.name}</div>
                    <div className={`text-[10px] ${isSelected ? 'text-emerald-100' : 'text-stone-400'}`}>
                      {surah.totalVerses} Ayat • Juz {surah.juz} • Hal {surah.startPage}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`font-arabic text-sm ${isSelected ? 'text-amber-200' : 'text-emerald-900'}`}>
                    {surah.arabicName}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer actions */}
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
            <span>Simpan Penanda</span>
          </button>
        </div>
      </div>
    </div>
  );
};
