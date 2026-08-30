import React, { useState, useEffect } from 'react';
import {
  getGoogleAppsScriptUrl,
  setGoogleAppsScriptUrl,
  testAppsScriptConnection,
  fetchAllDataFromSheets,
  pushAllDataToSheets,
  getLastSyncTime
} from '../utils/sheetsApi';
import { GOOGLE_APPS_SCRIPT_CODE } from '../utils/googleAppsScriptCode';
import { AllSheetsData } from '../utils/sheetsApi';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  ExternalLink,
  Smartphone,
  Laptop,
  Check,
  Database,
  Upload,
  Download,
  Info,
  Layers,
  Sparkles,
  X
} from 'lucide-react';

interface GoogleSheetsSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataSynced: () => void;
  currentAllData?: AllSheetsData;
}

export default function GoogleSheetsSetupModal({
  isOpen,
  onClose,
  onDataSynced,
  currentAllData
}: GoogleSheetsSetupModalProps) {
  const [urlInput, setUrlInput] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    spreadsheetName?: string;
  } | null>(null);

  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [hasCopiedCode, setHasCopiedCode] = useState(false);
  const [hasCopiedUrl, setHasCopiedUrl] = useState(false);
  const [activeTab, setActiveTab] = useState<'status' | 'code' | 'guide'>('status');
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const savedUrl = getGoogleAppsScriptUrl();
      setUrlInput(savedUrl);
      setLastSync(getLastSyncTime());
      if (savedUrl) {
        // Auto test connection on open if URL exists
        handleTestConnection(savedUrl);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveUrl = () => {
    setGoogleAppsScriptUrl(urlInput);
    setActionNotice('URL Google Apps Script berhasil disimpan di perangkat ini.');
    handleTestConnection(urlInput);
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleTestConnection = async (testUrlToUse?: string) => {
    const targetUrl = (testUrlToUse !== undefined ? testUrlToUse : urlInput).trim();
    if (!targetUrl) {
      setTestResult({
        success: false,
        message: 'Masukkan URL Google Apps Script terlebih dahulu.'
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testAppsScriptConnection(targetUrl);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Gagal terhubung ke Google Apps Script.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handlePullData = async () => {
    setIsPulling(true);
    setActionNotice(null);
    try {
      const res = await fetchAllDataFromSheets();
      if (res.success) {
        setLastSync(new Date().toISOString());
        setActionNotice('✅ Berhasil menarik data terbaru dari Google Spreadsheet ke perangkat ini!');
        onDataSynced();
      } else {
        setActionNotice(`❌ Gagal: ${res.error || 'Terjadi kesalahan saat membaca sheet'}`);
      }
    } catch (err: any) {
      setActionNotice(`❌ Error: ${err.message}`);
    } finally {
      setIsPulling(false);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  const handlePushData = async () => {
    if (!currentAllData) {
      setActionNotice('❌ Data lokal tidak tersedia untuk diunggah.');
      return;
    }
    if (!window.confirm('Unggah semua data saat ini ke Google Spreadsheet? Sheet yang ada akan disinkronkan.')) {
      return;
    }

    setIsPushing(true);
    setActionNotice(null);
    try {
      const ok = await pushAllDataToSheets(currentAllData);
      if (ok) {
        setLastSync(new Date().toISOString());
        setActionNotice('✅ Semua data berhasil diunggah ke Google Spreadsheet!');
        onDataSynced();
      } else {
        setActionNotice('❌ Gagal mengunggah data ke Spreadsheet. Cek URL & hak akses Web App.');
      }
    } catch (err: any) {
      setActionNotice(`❌ Error: ${err.message}`);
    } finally {
      setIsPushing(false);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  const handleCopyScriptCode = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setHasCopiedCode(true);
    setTimeout(() => setHasCopiedCode(false), 2500);
  };

  const handleCopyCurrentUrl = () => {
    if (!urlInput) return;
    navigator.clipboard.writeText(urlInput);
    setHasCopiedUrl(true);
    setTimeout(() => setHasCopiedUrl(false), 2500);
  };

  const formatDateTimeIndo = (isoStr?: string | null) => {
    if (!isoStr) return 'Belum pernah';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div
      id="modal-google-sheets-setup"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-800 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center border border-white/20 shadow-inner">
              <FileSpreadsheet className="w-6 h-6 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Koneksi Google Spreadsheet Multi-Device</h2>
              <p className="text-xs text-emerald-100/90">
                Database Cloud Real-Time untuk Sinkronisasi Laptop ↔ HP
              </p>
            </div>
          </div>
          <button
            id="btn-close-sheets-modal"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-3 gap-2">
          <button
            id="tab-sheets-status"
            onClick={() => setActiveTab('status')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'status'
                ? 'bg-white border-emerald-600 text-emerald-800 shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-4 h-4 text-emerald-600" />
            Status & URL API
          </button>

          <button
            id="tab-sheets-code"
            onClick={() => setActiveTab('code')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'code'
                ? 'bg-white border-emerald-600 text-emerald-800 shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4 text-teal-600" />
            Kode Apps Script (Code.gs)
          </button>

          <button
            id="tab-sheets-guide"
            onClick={() => setActiveTab('guide')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'guide'
                ? 'bg-white border-emerald-600 text-emerald-800 shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Info className="w-4 h-4 text-cyan-600" />
            Panduan Deploy
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          {/* Action Notice Alert */}
          {actionNotice && (
            <div className="p-3.5 rounded-xl bg-slate-900 text-white text-sm flex items-center justify-between shadow-md animate-fade-in">
              <span className="font-medium">{actionNotice}</span>
            </div>
          )}

          {/* TAB 1: STATUS & URL API */}
          {activeTab === 'status' && (
            <div className="space-y-6">
              {/* Multi-Device Architecture Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Arsitektur Terhubung Cloud
                  </span>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-200/70 text-emerald-900 font-semibold">
                    Multi-Device Active
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs text-slate-700 py-2">
                  <div className="p-2 bg-white rounded-lg border border-emerald-100 shadow-xs flex flex-col items-center">
                    <Laptop className="w-5 h-5 text-emerald-700 mb-1" />
                    <span className="font-bold">💻 Laptop MD/Admin</span>
                    <span className="text-[10px] text-slate-500">Live Read & Write</span>
                  </div>
                  <div className="p-2 bg-emerald-600 text-white rounded-lg shadow-sm flex flex-col items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-100 mb-1" />
                    <span className="font-bold">Google Sheets API</span>
                    <span className="text-[10px] text-emerald-200">Single Source of Truth</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-emerald-100 shadow-xs flex flex-col items-center">
                    <Smartphone className="w-5 h-5 text-emerald-700 mb-1" />
                    <span className="font-bold">📱 HP Jagal / Butcher</span>
                    <span className="text-[10px] text-slate-500">Live Read & Write</span>
                  </div>
                </div>
              </div>

              {/* URL Input Section */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  URL Web App Google Apps Script
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="input-apps-script-url"
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="flex gap-2">
                    <button
                      id="btn-save-sheets-url"
                      onClick={handleSaveUrl}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors whitespace-nowrap shadow-sm"
                    >
                      Simpan URL
                    </button>
                    <button
                      id="btn-test-sheets-url"
                      onClick={() => handleTestConnection()}
                      disabled={isTesting}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                      {isTesting ? 'Menguji...' : 'Uji Koneksi'}
                    </button>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-blue-50/80 border border-blue-200 text-blue-900 text-[11px] space-y-1">
                  <div className="font-semibold flex items-center gap-1">
                    <span>💡 Tips Otomatisasi (Bebas Input di HP):</span>
                  </div>
                  <p>
                    Anda bisa memasukkan URL ini ke Environment Variable Netlify / <code>.env</code> dengan nama:
                    <br />
                    <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono text-blue-950 font-bold select-all">VITE_GOOGLE_SHEETS_APPS_SCRIPT_URL=https://script.google.com/.../exec</code>
                  </p>
                  <p className="text-blue-700">
                    Dengan begitu, setiap kali HP atau Laptop membuka link Netlify, aplikasi langsung otomatis terhubung tanpa perlu paste URL manual lagi.
                  </p>
                </div>
              </div>

              {/* Test Result Indicator */}
              {testResult && (
                <div
                  className={`p-4 rounded-xl border flex items-start gap-3 ${
                    testResult.success
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50/70 border-rose-200 text-rose-900'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="text-xs space-y-1">
                    <p className="font-bold">{testResult.message}</p>
                    {testResult.spreadsheetName && (
                      <p className="text-emerald-700">
                        📄 File Spreadsheet: <span className="font-semibold">{testResult.spreadsheetName}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Synchronization Controls */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span className="font-medium">Waktu Sinkronisasi Terakhir:</span>
                  <span className="font-semibold text-slate-800">{formatDateTimeIndo(lastSync)}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                  <button
                    id="btn-pull-sheets-data"
                    onClick={handlePullData}
                    disabled={isPulling || isPushing}
                    className="p-3 bg-white hover:bg-slate-100 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-50"
                  >
                    <Download className={`w-4 h-4 text-emerald-600 ${isPulling ? 'animate-bounce' : ''}`} />
                    {isPulling ? 'Menarik Data...' : 'Tarik Data dari Spreadsheet (GET)'}
                  </button>

                  <button
                    id="btn-push-sheets-data"
                    onClick={handlePushData}
                    disabled={isPulling || isPushing}
                    className="p-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-50"
                  >
                    <Upload className={`w-4 h-4 text-teal-600 ${isPushing ? 'animate-bounce' : ''}`} />
                    {isPushing ? 'Mengunggah...' : 'Unggah Data Lokal ke Spreadsheet (POST)'}
                  </button>
                </div>
              </div>

              {/* Share URL to Phone / Other Device */}
              {urlInput && (
                <div className="p-3.5 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-between">
                  <div className="text-xs text-cyan-900">
                    <p className="font-bold">📱 Buka di HP atau Laptop Lain:</p>
                    <p className="text-[11px] text-cyan-700">
                      Gunakan link Netlify yang sama, lalu tempel URL API ini di HP untuk langsung tersambung.
                    </p>
                  </div>
                  <button
                    id="btn-copy-sheets-url"
                    onClick={handleCopyCurrentUrl}
                    className="px-3 py-2 bg-cyan-700 hover:bg-cyan-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0 shadow-xs"
                  >
                    {hasCopiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {hasCopiedUrl ? 'Tersalin' : 'Salin URL'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: KODE APPS SCRIPT (CODE.GS) */}
          {activeTab === 'code' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Kode Google Apps Script Lengkap (Code.gs)</h3>
                  <p className="text-xs text-slate-500">
                    Mendukung <span className="font-semibold text-emerald-700">doGet()</span>, <span className="font-semibold text-emerald-700">doPost()</span>, dan <span className="font-semibold text-emerald-700">ScriptLock</span> untuk proteksi concurrent update Laptop ↔ HP.
                  </p>
                </div>
                <button
                  id="btn-copy-code-gs"
                  onClick={handleCopyScriptCode}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm shrink-0"
                >
                  {hasCopiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {hasCopiedCode ? 'Kode Berhasil Disalin!' : 'Salin Semua Kode'}
                </button>
              </div>

              <div className="relative">
                <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono leading-relaxed overflow-x-auto max-h-80 border border-slate-800 select-all">
                  {GOOGLE_APPS_SCRIPT_CODE}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: PANDUAN DEPLOY */}
          {activeTab === 'guide' && (
            <div className="space-y-4 text-xs leading-relaxed text-slate-700">
              <h3 className="text-sm font-bold text-slate-900">
                Cara Memasang & Menghubungkan Google Spreadsheet (5 Menit)
              </h3>

              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    1
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">Buka Google Spreadsheet Anda</p>
                    <p className="text-slate-600 text-[11px] mt-0.5">
                      Buka file spreadsheet Anda di browser (misalnya sheet laporan daging TDN).
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    2
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">Buka Apps Script</p>
                    <p className="text-slate-600 text-[11px] mt-0.5">
                      Klik menu atas: <span className="font-bold text-slate-800">Ekstensi (Extensions)</span> →{' '}
                      <span className="font-bold text-slate-800">Apps Script</span>.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    3
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">Ganti Isi Code.gs</p>
                    <p className="text-slate-600 text-[11px] mt-0.5">
                      Hapus semua kode lama di <span className="font-mono text-emerald-800">Code.gs</span>, lalu paste (tempel) kode dari tab "Kode Apps Script" di modal ini. Tekan Ctrl+S (Simpan).
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    4
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">Terapkan sebagai Web App</p>
                    <p className="text-slate-600 text-[11px] mt-0.5">
                      Klik tombol biru <span className="font-bold text-slate-800">Terapkan (Deploy)</span> di kanan atas →{' '}
                      <span className="font-bold text-slate-800">Penerapan Baru (New deployment)</span>.
                    </p>
                    <ul className="list-disc list-inside text-[11px] text-slate-600 mt-1 space-y-0.5 pl-1">
                      <li>Pilih jenis: <b>Aplikasi web (Web app)</b></li>
                      <li>Jalankan sebagai: <b>Saya (Email Anda)</b></li>
                      <li>Siapa yang memiliki akses: <b className="text-emerald-700">Siapa saja (Anyone)</b> (Penting agar HP & Laptop bisa akses!)</li>
                    </ul>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    5
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">Salin URL & Masukkan ke Aplikasi Ini</p>
                    <p className="text-slate-600 text-[11px] mt-0.5">
                      Salin URL Web App yang berakhiran <span className="font-mono text-emerald-800">/exec</span>, lalu masukkan ke kolom URL di tab "Status & URL API" di atas. Selesai!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Siap untuk Netlify, Desktop, & Mobile Web
          </div>
          <button
            id="btn-footer-close-sheets-modal"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
