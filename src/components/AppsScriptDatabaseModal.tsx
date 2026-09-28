import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  ExternalLink,
  Layers,
  Database,
  Wifi,
  WifiOff,
  Sparkles,
  ChevronDown,
  ChevronUp,
  X,
  Play,
  ArrowRightLeft,
  Check,
  ShieldCheck,
  Users
} from 'lucide-react';
import { GOOGLE_APPS_SCRIPT_SOURCE } from '../utils/appsScriptCode';

interface AppsScriptDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshAllData: (silent?: boolean) => Promise<void>;
  counts?: {
    stores: number;
    users: number;
    cogs: number;
    thawing: number;
    segments: number;
    closing: number;
    grn: number;
    adjustments: number;
    reports: number;
    susut: number;
  };
}

const DEFAULT_APPSCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwYdrQaoe-083CyDAVoEv0AXXDIR6mEexvTmgyhahpGGHv7VC7jcRuxHUysiHUfs_Am/exec';

export default function AppsScriptDatabaseModal({
  isOpen,
  onClose,
  onRefreshAllData,
  counts,
}: AppsScriptDatabaseModalProps) {
  const [appscriptUrl, setAppscriptUrl] = useState(DEFAULT_APPSCRIPT_URL);
  const [isConfigured, setIsConfigured] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitSheets, setIsInitSheets] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latency?: number; isAuthRequired?: boolean } | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  // Fetch current config on open
  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    try {
      const res = await fetch('/api/appscript/config');
      if (res.ok) {
        const data = await res.json();
        setAppscriptUrl(data.url || DEFAULT_APPSCRIPT_URL);
        setIsConfigured(Boolean(data.configured || data.url));
        setAutoSync(data.autoSync !== false);
        setLastSyncTime(data.lastSync || null);
      }
    } catch {
      // Local fallback
      const saved = localStorage.getItem('appscript_web_app_url');
      if (saved) {
        setAppscriptUrl(saved);
        setIsConfigured(true);
      } else {
        setAppscriptUrl(DEFAULT_APPSCRIPT_URL);
        setIsConfigured(true);
      }
    }
  };

  const handleSaveConfig = async (overrideUrl?: string) => {
    const targetUrl = (overrideUrl !== undefined ? overrideUrl : appscriptUrl).trim();
    setActionSuccessMsg(null);
    setActionErrorMsg(null);

    try {
      const res = await fetch('/api/appscript/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl, autoSync }),
      });

      if (res.ok) {
        localStorage.setItem('appscript_web_app_url', targetUrl);
        setIsConfigured(Boolean(targetUrl));
        setActionSuccessMsg('✓ Konfigurasi URL Apps Script Google Spreadsheet berhasil disimpan!');
        setTimeout(() => setActionSuccessMsg(null), 4000);
      } else {
        const err = await res.json();
        setActionErrorMsg(err.error || 'Gagal menyimpan konfigurasi');
      }
    } catch (e: any) {
      localStorage.setItem('appscript_web_app_url', targetUrl);
      setIsConfigured(Boolean(targetUrl));
      setActionSuccessMsg('✓ URL tersimpan di penyimpanan aplikasi!');
      setTimeout(() => setActionSuccessMsg(null), 4000);
    }
  };

  const handleTestConnection = async () => {
    if (!appscriptUrl.trim()) {
      setTestResult({ success: false, message: 'Harap masukkan URL Google Apps Script Web App terlebih dahulu.' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setActionSuccessMsg(null);
    setActionErrorMsg(null);

    try {
      const startTime = Date.now();
      const res = await fetch('/api/appscript/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: appscriptUrl.trim() }),
      });
      const latency = Date.now() - startTime;

      if (res.ok) {
        const data = await res.json();
        setTestResult({
          success: true,
          message: data.message || 'Koneksi ke Google Spreadsheet Berhasil! Web App Apps Script aktif.',
          latency,
        });
        setIsConfigured(true);
      } else {
        const err = await res.json();
        setTestResult({
          success: false,
          message: err.error || 'Gagal menghubungi Web App. Pastikan akses diatur ke "Anyone" (Siapa saja).',
          latency,
          isAuthRequired: Boolean(err.isAuthRequired),
        });
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        message: 'Koneksi error: ' + (e?.message || 'Pastikan server dan koneksi internet stabil'),
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleInitSheets = async () => {
    setIsInitSheets(true);
    setActionSuccessMsg(null);
    setActionErrorMsg(null);

    try {
      const res = await fetch('/api/appscript/init-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: appscriptUrl.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setActionSuccessMsg(`✓ Seluruh 11 Tab Spreadsheet (${data.sheets?.length || 11} sheet) berhasil dibuat dan diformat rapi dengan header lengkap!`);
      } else {
        const err = await res.json();
        setActionErrorMsg(err.error || 'Gagal menginisialisasi tab spreadsheet');
      }
    } catch (e: any) {
      setActionErrorMsg('Gagal inisialisasi: ' + e.message);
    } finally {
      setIsInitSheets(false);
    }
  };

  const handleSyncAll = async () => {
    setIsSyncing(true);
    setActionSuccessMsg(null);
    setActionErrorMsg(null);

    try {
      const res = await fetch('/api/appscript/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const data = await res.json();
        const now = new Date().toLocaleTimeString('id-ID');
        setLastSyncTime(now);
        setActionSuccessMsg(`✓ Sinkronisasi Realtime Berhasil! Data Butcher, Admin, dan MD telah terhubung ke Google Spreadsheet (Pukul ${now}).`);
        await onRefreshAllData(true);
      } else {
        const err = await res.json();
        setActionErrorMsg(err.error || 'Gagal sinkronisasi');
      }
    } catch (e: any) {
      setActionErrorMsg('Gagal sinkronisasi: ' + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullFromSheets = async () => {
    setIsSyncing(true);
    setActionSuccessMsg(null);
    setActionErrorMsg(null);

    try {
      const res = await fetch('/api/appscript/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const data = await res.json();
        const now = new Date().toLocaleTimeString('id-ID');
        setLastSyncTime(now);
        setActionSuccessMsg(`✓ Berhasil menarik data terbaru dari Google Spreadsheet ke aplikasi! (${data.totalRecords || 0} entri terupdate)`);
        await onRefreshAllData(true);
      } else {
        const err = await res.json();
        setActionErrorMsg(err.error || 'Gagal menarik data dari spreadsheet');
      }
    } catch (e: any) {
      setActionErrorMsg('Gagal menarik data: ' + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const copyScriptToClipboard = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_SOURCE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white flex items-center justify-between border-b border-emerald-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600/30 rounded-xl border border-emerald-400/30 text-emerald-300">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Database Google Spreadsheet AppScript
                </h2>
                {isConfigured ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Online & Realtime
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    Database Lokal Aktif
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300">
                Hubungkan seluruh data Butcher, Admin Toko, dan MD Pusat ke Google Sheets secara realtime
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">

          {/* Feedback Banners */}
          {actionSuccessMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2.5 text-xs font-medium animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{actionSuccessMsg}</span>
            </div>
          )}

          {actionErrorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2.5 text-xs font-medium animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{actionErrorMsg}</span>
            </div>
          )}

          {/* Realtime Multi-Account Connectivity Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-700 font-bold text-xs shrink-0">
                🥩 Butcher
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Input Butcher Terhubung</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                  Thawing, potong pabrikasi, & closing fisik otomatis muncul di akun Admin & MD tanpa jeda.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-xs shrink-0">
                🏢 Admin
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Input Admin Terhubung</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                  Penerimaan GRN, koreksi stok in/out, & input susulan langsung tersinkron ke akun Butcher.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-purple-100 text-purple-700 font-bold text-xs shrink-0">
                👑 MD Pusat
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Kontrol MD Terhubung</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                  Update HPP Master COGS & limit susut langsung berlaku di semua cabang toko.
                </p>
              </div>
            </div>
          </div>

          {/* Section 1: Web App URL Configuration */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-600" />
                  URL Google Apps Script Web App
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Masukkan Web App URL hasil deployment dari Google Spreadsheet Anda
                </p>
              </div>
              {lastSyncTime && (
                <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md self-start sm:self-auto">
                  Terakhir Sinkron: <strong className="text-slate-800">{lastSyncTime}</strong>
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="url"
                value={appscriptUrl}
                onChange={(e) => setAppscriptUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="flex-1 px-3.5 py-2.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !appscriptUrl.trim()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    <span>Menguji...</span>
                  </>
                ) : (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Test Koneksi</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleSaveConfig()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
              >
                <span>Simpan URL</span>
              </button>
            </div>

            {/* Test Result Display */}
            {testResult && (
              <div
                className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-medium ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <div className="flex-1">
                  <span>{testResult.message}</span>
                  {testResult.latency !== undefined && (
                    <span className="ml-2 text-[10px] text-slate-500">
                      (Waktu respon: {testResult.latency} ms)
                    </span>
                  )}
                  {testResult.isAuthRequired && (
                    <div className="mt-2.5 p-2.5 bg-amber-100/80 rounded-lg border border-amber-300 text-amber-900 text-[11px] leading-relaxed">
                      <strong>Cara 1 Menit Mengubah Izin Akses di Google Apps Script:</strong>
                      <ol className="list-decimal list-inside mt-1 space-y-0.5">
                        <li>Buka Google Spreadsheet &rarr; Ekstensi &rarr; Apps Script</li>
                        <li>Klik tombol biru <strong>Terapkan (Deploy)</strong> di kanan atas &rarr; <strong>Kelola penerapan (Manage deployments)</strong></li>
                        <li>Klik <strong>ikon pensil (Edit)</strong> di pojok kanan atas pop-up penerapan</li>
                        <li>Pada bagian <em>"Siapa yang memiliki akses" (Who has access)</em>, ubah dari "Hanya saya" menjadi <strong>"Siapa saja" (Anyone)</strong></li>
                        <li>Klik <strong>Terapkan (Deploy)</strong>, lalu klik <strong>Test Koneksi</strong> kembali di sini!</li>
                      </ol>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoSyncCheck"
                  checked={autoSync}
                  onChange={(e) => {
                    setAutoSync(e.target.checked);
                    handleSaveConfig(appscriptUrl);
                  }}
                  className="w-4 h-4 text-emerald-600 rounded-sm border-slate-300 focus:ring-emerald-500"
                />
                <label htmlFor="autoSyncCheck" className="text-xs font-medium text-slate-700 cursor-pointer">
                  Sinkronisasi Otomatis Realtime saat ada input baru
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleInitSheets}
                  disabled={isInitSheets || !appscriptUrl.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                  title="Membuat dan merapikan 11 tab sheet di Google Spreadsheet dengan warna header & kolom yang jelas"
                >
                  {isInitSheets ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  )}
                  <span>Inisialisasi Tab Spreadsheet</span>
                </button>

                <button
                  type="button"
                  onClick={handlePullFromSheets}
                  disabled={isSyncing || !appscriptUrl.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-slate-600" />
                  <span>Tarik dari Sheet</span>
                </button>

                <button
                  type="button"
                  onClick={handleSyncAll}
                  disabled={isSyncing || !appscriptUrl.trim()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSyncing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span>Sinkronkan Sekarang</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Realtime Database Tables Overview */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                Struktur 11 Tab Database Spreadsheet (Semua Akun)
              </h3>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Bisa Input Nama & Jumlah Sama
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Database menampung seluruh pencatatan transaksi dari Butcher, Admin Toko, dan MD Pusat. Data yang memiliki nama dan jumlah yang sama (misal 2 kiriman sosis 10 Kg di hari yang sama) akan tersimpan rapi dengan ID transaksi unik masing-masing.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-2">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-400">Sheet 1</div>
                <div className="text-xs font-bold text-slate-800 truncate">Daftar_Toko</div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">{counts?.stores || 0} Toko Cabang</div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-400">Sheet 2</div>
                <div className="text-xs font-bold text-slate-800 truncate">Pengguna</div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">{counts?.users || 0} Akun User</div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-400">Sheet 3</div>
                <div className="text-xs font-bold text-slate-800 truncate">Master_COGS</div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">{counts?.cogs || 0} Item HPP</div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-400">Sheet 4</div>
                <div className="text-xs font-bold text-slate-800 truncate">Thawing_Daging</div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">{counts?.thawing || 0} Thawing Butcher</div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-400">Sheet 5</div>
                <div className="text-xs font-bold text-slate-800 truncate">Pabrikasi_Segmen</div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">{counts?.segments || 0} Potongan Segmen</div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-400">Sheet 6</div>
                <div className="text-xs font-bold text-slate-800 truncate">Closing_Harian</div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">{counts?.closing || 0} Closing Fisik</div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-400">Sheet 7</div>
                <div className="text-xs font-bold text-slate-800 truncate">Penerimaan_GRN</div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">{counts?.grn || 0} Penerimaan GRN</div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-400">Sheet 8</div>
                <div className="text-xs font-bold text-slate-800 truncate">Koreksi_Stok_Admin</div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">{counts?.adjustments || 0} Koreksi Stok</div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-400">Sheet 9</div>
                <div className="text-xs font-bold text-slate-800 truncate">Laporan_Harian_Rekap</div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">{counts?.reports || 0} Rekap Harian</div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-400">Sheet 10</div>
                <div className="text-xs font-bold text-slate-800 truncate">Data_Susut</div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">{counts?.susut || 0} Catatan Susut</div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 col-span-2">
                <div className="text-[10px] uppercase font-bold text-slate-400">Sheet 11</div>
                <div className="text-xs font-bold text-slate-800 truncate">Konfigurasi_Sistem</div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">Toleransi Susut, Target & Ambang Batas</div>
              </div>
            </div>
          </div>

          {/* Section 3: Step-by-Step Installation Tutorial & Code Viewer */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Panduan Pemasangan Google Apps Script (Hanya 1 Kali)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ikuti langkah mudah di bawah untuk menghubungkan Google Spreadsheet Anda
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCode(!showCode)}
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
              >
                <span>{showCode ? 'Sembunyikan Script' : 'Lihat Script Code.gs'}</span>
                {showCode ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside bg-white p-4 rounded-xl border border-slate-200">
              <li>
                Buka Google Spreadsheet baru di browser: <a href="https://sheets.new" target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline font-bold inline-flex items-center gap-0.5">sheets.new <ExternalLink className="w-3 h-3" /></a>
              </li>
              <li>
                Di Google Spreadsheet, klik menu <strong>Ekstensi (Extensions)</strong> &rarr; <strong>Apps Script</strong>.
              </li>
              <li>
                Hapus isi file <code>Code.gs</code> yang ada, lalu klik tombol <strong>Salin Script Code.gs</strong> di bawah dan Paste ke sana.
              </li>
              <li>
                Klik icon <strong>Simpan (Save)</strong> (Ctrl+S / Cmd+S).
              </li>
              <li>
                Klik tombol biru <strong>Terapkan (Deploy)</strong> &rarr; <strong>Penerapan baru (New deployment)</strong>.
              </li>
              <li>
                Pilih jenis: <strong>Aplikasi Web (Web app)</strong>.
              </li>
              <li>
                Atur <em>Jalankan sebagai (Execute as)</em>: <strong>Saya (Me)</strong>, dan <em>Siapa yang memiliki akses (Who has access)</em>: <strong>Siapa saja (Anyone)</strong>.
              </li>
              <li>
                Klik <strong>Terapkan (Deploy)</strong>, setujui izin akses akun Google Anda, lalu salin URL yang berakhiran <code>/exec</code> ke kolom di atas.
              </li>
            </ol>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={copyScriptToClipboard}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedCode ? '✓ Script Berhasil Disalin!' : 'Salin Script Code.gs Lengkap'}</span>
              </button>
            </div>

            {showCode && (
              <div className="mt-3 relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 text-slate-200 p-4 font-mono text-[11px] leading-relaxed max-h-72 overflow-y-auto">
                <pre>{GOOGLE_APPS_SCRIPT_SOURCE}</pre>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Realtime Sync: Butcher &harr; Admin &harr; MD &harr; Google Sheets</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}
