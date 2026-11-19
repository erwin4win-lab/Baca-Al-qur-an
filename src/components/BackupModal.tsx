import React, { useState, useRef, useEffect } from 'react';
import {
  Download,
  Upload,
  X,
  Check,
  Copy,
  AlertTriangle,
  FileJson,
  CheckCircle2,
  HardDrive,
  RefreshCw,
  FileText
} from 'lucide-react';
import { DayRecord, UserSettings } from '../types/quran';
import { exportBackupData, parseAndValidateBackup, QuranBackupPayload } from '../utils/backup';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

interface BackupModalProps {
  settings: UserSettings;
  records: Record<string, DayRecord>;
  onRestoreData: (newSettings: UserSettings, newRecords: Record<string, DayRecord>) => void;
  onClose: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  settings,
  records,
  onRestoreData,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [copied, setCopied] = useState(false);
  const [importStatus, setImportStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [parsedPreview, setParsedPreview] = useState<QuranBackupPayload | null>(null);
  const [pasteJsonInput, setPasteJsonInput] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [confirmRestorePending, setConfirmRestorePending] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // Export summary calculations
  const totalDays = Object.keys(records || {}).length;
  const totalPagesRead = Object.values(records || {}).reduce(
    (sum, r) => sum + (r?.completedPages || 0),
    0
  );

  const handleExportFile = () => {
    try {
      exportBackupData(settings, records);
      setImportStatus({
        success: true,
        message: 'File cadangan JSON berhasil diunduh ke perangkat Anda.'
      });
    } catch {
      setImportStatus({
        success: false,
        message: 'Gagal mengunduh file cadangan.'
      });
    }
  };

  const handleCopyJson = async () => {
    try {
      const { jsonString } = exportBackupData(settings, records);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(jsonString);
        setCopied(true);
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => setCopied(false), 2500);
      } else {
        setImportStatus({
          success: false,
          message: 'Clipboard browser tidak tersedia di lingkungan ini.'
        });
      }
    } catch {
      setImportStatus({
        success: false,
        message: 'Gagal menyalin JSON ke clipboard.'
      });
    }
  };

  const processJsonContent = (text: string) => {
    setConfirmRestorePending(false);
    const validation = parseAndValidateBackup(text);
    if (!validation.success || !validation.data) {
      setImportStatus({
        success: false,
        message: validation.error || 'Berkas cadangan tidak valid atau rusak.'
      });
      setParsedPreview(null);
      return;
    }

    setParsedPreview(validation.data);
    setImportStatus({
      success: true,
      message: 'File backup valid! Silakan tinjau pratinjau sebelum memulihkan.'
    });
  };

  const readBackupFile = (file: File) => {
    if (file.size > MAX_UPLOAD_BYTES) {
      setImportStatus({
        success: false,
        message: 'Ukuran berkas melebihi batas maksimal 5 MB.'
      });
      setParsedPreview(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = typeof event.target?.result === 'string' ? event.target.result : '';
      processJsonContent(content);
    };
    reader.onerror = () => {
      setImportStatus({
        success: false,
        message: 'Gagal membaca berkas dari perangkat.'
      });
      setParsedPreview(null);
    };
    reader.readAsText(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readBackupFile(file);
    // Reset input agar file yang sama bisa dipilih kembali jika perlu
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    readBackupFile(file);
  };

  const handleConfirmRestore = () => {
    if (!parsedPreview) return;

    if (!confirmRestorePending) {
      setConfirmRestorePending(true);
      return;
    }

    onRestoreData(
      parsedPreview.settings || settings,
      parsedPreview.records
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-scaleUp flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
              <HardDrive className="w-5 h-5 text-emerald-700" />
            </span>
            <div>
              <h3 className="text-base font-bold text-stone-900">Backup & Pemulihan Data</h3>
              <p className="text-xs text-stone-500">Cadangkan atau pulihkan progres tilawah Anda secara mandiri</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-3 bg-stone-100 border-b border-stone-200 gap-2">
          <button
            onClick={() => {
              setActiveTab('export');
              setImportStatus(null);
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'export'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-200'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Ekspor Cadangan (Backup)</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('import');
              setImportStatus(null);
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'import'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Impor Cadangan (Restore)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Status Message */}
          {importStatus && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 animate-fadeIn ${
                importStatus.success
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {importStatus.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              )}
              <span>{importStatus.message}</span>
            </div>
          )}

          {/* TAB 1: EXPORT */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                <div className="flex items-center gap-2 text-emerald-950 font-bold text-xs uppercase tracking-wider">
                  <FileJson className="w-4 h-4 text-emerald-700" />
                  <span>Ringkasan Data Saat Ini</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                    <span className="text-stone-500 block text-[10px]">Total Hari Tercatat</span>
                    <strong className="text-stone-900 text-sm font-bold">{totalDays} Hari</strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                    <span className="text-stone-500 block text-[10px]">Halaman Terbaca</span>
                    <strong className="text-emerald-700 text-sm font-bold">{totalPagesRead} Hal</strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                    <span className="text-stone-500 block text-[10px]">Paket Khatam</span>
                    <strong className="text-stone-900 text-xs font-bold">{settings.planId} Khatam</strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                    <span className="text-stone-500 block text-[10px]">Penanda Terakhir</span>
                    <strong className="text-stone-900 text-xs font-bold truncate block">
                      {settings.lastReadSurah || 'Al-Baqarah'}: {settings.lastReadAyat || 1}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  onClick={handleExportFile}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh File Cadangan (.json)</span>
                </button>

                <button
                  onClick={handleCopyJson}
                  className="w-full py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer border border-stone-200"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Data JSON Tersalin ke Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-stone-500" />
                      <span>Salin Teks JSON (Bisa dikirim via chat/catatan)</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-stone-500 text-center leading-relaxed">
                Berkas JSON ini dapat Anda simpan di Google Drive, memori HP, atau dikirimkan ke perangkat lain untuk dipulihkan kapan saja.
              </p>
            </div>
          )}

          {/* TAB 2: IMPORT */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              {/* Drag and Drop Box */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 rounded-2xl border-2 border-dashed text-center transition cursor-pointer flex flex-col items-center justify-center gap-2 ${
                  isDragOver
                    ? 'border-emerald-500 bg-emerald-50/70'
                    : 'border-stone-300 hover:border-emerald-500 bg-stone-50/50'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-stone-800 block">
                    Pilih Berkas JSON atau Tarik ke Sini
                  </span>
                  <span className="text-[11px] text-stone-500">Mendukung format file .json</span>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".json,application/json"
                  className="hidden"
                />
              </div>

              {/* Paste Text Alternative */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-stone-500" />
                  <span>Atau Tempel (Paste) Teks JSON:</span>
                </label>
                <textarea
                  rows={3}
                  value={pasteJsonInput}
                  onChange={(e) => {
                    setPasteJsonInput(e.target.value);
                    if (e.target.value.trim()) {
                      processJsonContent(e.target.value);
                    }
                  }}
                  placeholder="Tempelkan isi JSON backup di sini..."
                  className="w-full text-xs font-mono p-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Parsed Preview if valid */}
              {parsedPreview && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2 animate-fadeIn">
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs uppercase tracking-wider">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Pratinjau Data Cadangan:</span>
                  </div>

                  <div className="text-xs space-y-1 text-stone-700">
                    <div>
                      <strong>Waktu Ekspor:</strong>{' '}
                      {new Date(parsedPreview.exportedAt).toLocaleString('id-ID')}
                    </div>
                    <div>
                      <strong>Total Catatan Harian:</strong>{' '}
                      {Object.keys(parsedPreview.records || {}).length} Hari
                    </div>
                    <div>
                      <strong>Total Halaman Terbaca:</strong>{' '}
                      <span className="font-bold text-emerald-800">{parsedPreview.summary?.totalPagesRead || 0} Halaman</span>
                    </div>
                    <div>
                      <strong>Target Khatam:</strong>{' '}
                      {parsedPreview.summary?.khatamPlan || parsedPreview.settings?.planId || '1x'}
                    </div>
                  </div>

                  {confirmRestorePending && (
                    <div className="p-2.5 rounded-xl bg-white border border-amber-300 text-[11px] text-amber-900 font-medium">
                      Perhatian: Memulihkan cadangan akan memperbarui progres tilawah Anda saat ini. Klik konfirmasi di bawah untuk melanjutkan.
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={handleConfirmRestore}
                      className={`flex-1 py-2.5 px-4 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs ${
                        confirmRestorePending
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-emerald-600 hover:bg-emerald-700'
                      }`}
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>
                        {confirmRestorePending
                          ? 'Konfirmasi Terapkan Pemulihan'
                          : 'Pulihkan & Terapkan Data Ini'}
                      </span>
                    </button>
                    {confirmRestorePending && (
                      <button
                        type="button"
                        onClick={() => setConfirmRestorePending(false)}
                        className="py-2.5 px-3 rounded-xl bg-white border border-stone-200 text-stone-600 hover:bg-stone-100 text-xs font-semibold cursor-pointer"
                      >
                        Batal
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
