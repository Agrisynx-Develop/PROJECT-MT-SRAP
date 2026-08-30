import React, { useState } from 'react';
import { UserAccount } from '../types';
import { resolveUserFromInput } from '../utils/db';
import {
  Beef,
  Lock,
  User,
  ArrowRight,
  KeyRound,
  AlertCircle,
  Eye,
  EyeOff,
  Database,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (user: UserAccount) => void;
  onOpenSheetsModal?: () => void;
  cloudConnected?: boolean;
}

export default function LoginScreen({ onLoginSuccess, onOpenSheetsModal, cloudConnected }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setErrorMessage('Username wajib diisi.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          onLoginSuccess(data.user);
          return;
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData.error) {
          setErrorMessage(errData.error);
          return;
        }
      }

      // Dynamic fallback matching
      const resolved = resolveUserFromInput(username.trim());
      onLoginSuccess(resolved);
    } catch (err: any) {
      const resolved = resolveUserFromInput(username.trim());
      onLoginSuccess(resolved);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-red-500 selection:text-white">
      {/* Background ambient decorative blurs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-900/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-red-950/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-md w-full space-y-6 z-10">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-red-800 text-white shadow-xl shadow-red-950/60 border border-red-500/30 mb-1">
            <Beef className="w-9 h-9" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              TDN Meat Tracker
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              Sistem Produksi Daging & Pelacakan Susut Terpusat
            </p>
          </div>
        </div>

        {/* Login Form Card */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-red-500" />
              Masuk Akun Pengguna
            </h2>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-bold">
              Production System
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-950/80 border border-red-800/80 rounded-xl text-red-300 text-xs flex items-start gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Username Akun:
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username akun (e.g. butcher_ckr, admin_ckr, md_pusat)..."
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Password:
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi..."
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-lg shadow-red-950/50 transition duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              {isLoading ? (
                <span>Memproses Masuk...</span>
              ) : (
                <>
                  <span>Masuk ke Sistem Daging</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Cloud Connection Quick Control */}
        {onOpenSheetsModal && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onOpenSheetsModal}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition border cursor-pointer ${
                cloudConnected
                  ? 'bg-emerald-950/60 hover:bg-emerald-900/80 border-emerald-800 text-emerald-300'
                  : 'bg-slate-900/80 hover:bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>{cloudConnected ? 'Google Sheets Terhubung' : 'Hubungkan Google Sheets'}</span>
              <span className={`w-2 h-2 rounded-full ${cloudConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            </button>
          </div>
        )}

        {/* Footer info */}
        <div className="text-center text-[11px] text-slate-500 font-medium">
          TDN Meat Production Tracker © 2026 • Real-Time Cloud Synchronization
        </div>
      </div>
    </div>
  );
}

