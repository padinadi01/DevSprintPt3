import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ApiError } from '../api/http';

interface PresetAccount {
  username: string;
  name: string;
  role: 'PEMILIK' | 'STAF';
  pin: string;
  icon: string;
  shift: string;
  badgeColor: string;
}

const PRESET_ACCOUNTS: PresetAccount[] = [
  {
    username: 'pemilik',
    name: 'Cak Rofi',
    role: 'PEMILIK',
    pin: '1234',
    icon: '👑',
    shift: 'Pemilik Warung (Akses Penuh)',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  {
    username: 'udin',
    name: 'Udin',
    role: 'STAF',
    pin: '1111',
    icon: '👤',
    shift: 'Shift Pagi (Penerima & Kasir)',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  {
    username: 'sari',
    name: 'Sari',
    role: 'STAF',
    pin: '2222',
    icon: '👤',
    shift: 'Shift Malam (Penerima & Kasir)',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
];

export function LoginPage() {
  const { user, login, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('pemilik');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);

  // If already logged in, redirect to destination or role-appropriate page
  useEffect(() => {
    if (isLoggedIn && user) {
      const from = (location.state as any)?.from?.pathname;
      if (from && from !== '/login') {
        navigate(from, { replace: true });
      } else if (user.role === 'PEMILIK') {
        navigate('/', { replace: true });
      } else {
        navigate('/stok', { replace: true });
      }
    }
  }, [isLoggedIn, user, navigate, location]);

  const handleSelectPreset = (acc: PresetAccount) => {
    setUsername(acc.username);
    setPin(acc.pin);
    setErrorMessage(null);
  };

  const handleKeypadPress = (val: string) => {
    if (val === 'backspace') {
      setPin((prev) => prev.slice(0, -1));
    } else if (val === 'clear') {
      setPin('');
    } else if (pin.length < 8) {
      setPin((prev) => prev + val);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username.trim() || !pin) {
      setErrorMessage('Silakan pilih akun dan masukkan PIN.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setIsRateLimited(false);

    try {
      await login(username.trim(), pin);
      // Navigation is triggered by useEffect on auth state update
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 429) {
        setIsRateLimited(true);
        setErrorMessage(
          'Terlalu banyak percobaan login gagal berturut-turut (Batas C7). Akses dibatasi sementara demi keamanan (HTTP 429).'
        );
      } else {
        setErrorMessage(err.message || 'Nama pengguna atau PIN salah.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-green-600 to-emerald-400 text-3xl shadow-lg shadow-green-500/20">
            🏪
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            Warung Madura <span className="text-emerald-400">Berkah 24 Jam</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Sistem Manajemen Pengadaan, Inventori Stok & Kasir Toko
          </p>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-semibold">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Autentikasi & RBAC Aktif (Blok C)
          </div>
        </div>

        {/* Main Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-800/80 p-6 shadow-2xl backdrop-blur-sm space-y-5">
          {/* Quick Preset Selector */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
              Pilih Pengguna / Shift
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_ACCOUNTS.map((acc) => {
                const isSelected = username === acc.username;
                return (
                  <button
                    key={acc.username}
                    type="button"
                    onClick={() => handleSelectPreset(acc)}
                    className={`flex flex-col items-center p-2.5 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-950/60 ring-2 ring-emerald-500/30'
                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-700/50'
                    }`}
                  >
                    <span className="text-xl mb-1">{acc.icon}</span>
                    <span className="text-xs font-bold text-white truncate w-full">
                      {acc.name}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full mt-1 border ${
                        acc.role === 'PEMILIK'
                          ? 'bg-purple-900/60 text-purple-300 border-purple-700'
                          : 'bg-emerald-900/60 text-emerald-300 border-emerald-700'
                      }`}
                    >
                      {acc.role}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Banner */}
            {errorMessage && (
              <div
                className={`rounded-xl p-3 text-xs font-medium border flex items-start gap-2.5 ${
                  isRateLimited
                    ? 'bg-amber-950/70 border-amber-800 text-amber-200'
                    : 'bg-red-950/70 border-red-800 text-red-200'
                }`}
              >
                <span className="text-base shrink-0">{isRateLimited ? '⚠️' : '❌'}</span>
                <div>
                  <p className="font-bold">{isRateLimited ? 'Batas Percobaan Terlampaui' : 'Login Gagal'}</p>
                  <p className="mt-0.5 opacity-90">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Username Input */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Nama Pengguna (Username)
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="cth: pemilik / udin / sari"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>

            {/* PIN Input */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-slate-300">
                  PIN Keamanan (Minimal 4 Angka)
                </label>
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300"
                >
                  {showPin ? 'Sembunyikan' : 'Lihat PIN'}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Ketik 4 digit PIN..."
                  maxLength={12}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-center text-lg tracking-widest font-mono text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            {/* Numeric Touch Keypad for POS */}
            <div className="pt-1">
              <div className="grid grid-cols-3 gap-1.5">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleKeypadPress(digit)}
                    className="h-10 rounded-lg border border-slate-700/80 bg-slate-800 text-sm font-bold text-slate-200 hover:bg-slate-700 active:scale-95 transition-all"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleKeypadPress('clear')}
                  className="h-10 rounded-lg border border-slate-700/80 bg-slate-800 text-xs font-bold text-slate-400 hover:bg-slate-700 active:scale-95 transition-all"
                >
                  C
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress('0')}
                  className="h-10 rounded-lg border border-slate-700/80 bg-slate-800 text-sm font-bold text-slate-200 hover:bg-slate-700 active:scale-95 transition-all"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress('backspace')}
                  className="h-10 rounded-lg border border-slate-700/80 bg-slate-800 text-sm font-bold text-slate-400 hover:bg-slate-700 active:scale-95 transition-all"
                >
                  ⌫
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2 mt-4"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Memverifikasi PIN...</span>
                </>
              ) : (
                <span>Masuk Sekarang →</span>
              )}
            </button>
          </form>
        </div>

        {/* Info Hints Footer */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-800/40 p-4 text-xs text-slate-400 space-y-1 text-center">
          <p className="font-semibold text-slate-300">🔑 Panduan Pengujian Kredensial:</p>
          <p>
            • <strong>Cak Rofi (Pemilik):</strong> PIN <code>1234</code> (Akses Master Control & Finansial)
          </p>
          <p>
            • <strong>Udin (Staf):</strong> PIN <code>1111</code> • <strong>Sari (Staf):</strong> PIN <code>2222</code>
          </p>
        </div>
      </div>
    </div>
  );
}
