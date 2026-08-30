import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearCacheAndReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error(e);
    }
    window.location.href = '/';
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-3 text-red-500">
              <div className="p-3 bg-red-950/60 border border-red-800/60 rounded-xl">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Terjadi Kendala Tampilan</h1>
                <p className="text-xs text-slate-400">Aplikasi mendeteksi error pada browser/komponen</p>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-red-400 overflow-x-auto max-h-48 whitespace-pre-wrap">
              {this.state.error?.toString() || 'Unknown runtime error'}
              {this.state.errorInfo?.componentStack && (
                <div className="mt-2 pt-2 border-t border-slate-800 text-slate-500 text-[11px]">
                  {this.state.errorInfo.componentStack}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={this.handleReload}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition shadow-lg shadow-red-900/30"
                >
                  <RefreshCw className="w-4 h-4" />
                  Muat Ulang Halaman
                </button>
                <button
                  onClick={this.handleClearCacheAndReset}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl transition border border-slate-700"
                >
                  <Trash2 className="w-4 h-4 text-amber-400" />
                  Reset Cache & Sesi
                </button>
              </div>
              <p className="text-[11px] text-center text-slate-500">
                Jika Anda mengakses via server lokal, pastikan dev server sedang aktif (`npm run dev`).
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;

