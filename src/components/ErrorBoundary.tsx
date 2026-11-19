import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RefreshCw, Trash2, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  confirmReset: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    confirmReset: false
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetDataAndReload = () => {
    if (!this.state.confirmReset) {
      this.setState({ confirmReset: true });
      return;
    }

    try {
      localStorage.clear();
    } catch (e) {
      console.error('Failed to clear localStorage', e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-stone-200 shadow-xl space-y-5 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto ring-8 ring-red-50/50">
              <AlertOctagon className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold text-stone-900">Terjadi Kendala Teknis</h2>
              <p className="text-xs text-stone-500 leading-relaxed">
                Aplikasi mendeteksi error tak terduga. Sistem Error Boundary kami telah mengisolasi masalah agar perangkat Anda tetap aman.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-left font-mono text-[11px] text-red-600 overflow-x-auto max-h-32">
                {this.state.error.message || 'Unknown Exception'}
              </div>
            )}

            {this.state.confirmReset && (
              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                Klik sekali lagi tombol konfirmasi di bawah untuk menyetel ulang cache lokal aplikasi.
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Muat Ulang Halaman</span>
              </button>

              <button
                onClick={this.handleResetDataAndReload}
                className={`py-2.5 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer border ${
                  this.state.confirmReset
                    ? 'bg-red-600 hover:bg-red-700 text-white border-red-700'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-200'
                }`}
                title="Hapus cache & muat ulang data bersih jika data lokal korup"
              >
                <Trash2 className="w-4 h-4" />
                <span>{this.state.confirmReset ? 'Konfirmasi Reset Data' : 'Reset Data Bersih'}</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
