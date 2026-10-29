import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ApiError } from '../api/http';
import { SeoHead } from '../components/SeoHead';
import { ThemeToggle } from '../components/ThemeToggle';

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
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-600/50',
  },
  {
    username: 'udin',
    name: 'Udin',
    role: 'STAF',
    pin: '1111',
    icon: '👤',
    shift: 'Shift Pagi (Penerima & Kasir)',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-600/50',
  },
  {
    username: 'sari',
    name: 'Sari',
    role: 'STAF',
    pin: '2222',
    icon: '👤',
    shift: 'Shift Malam (Penerima & Kasir)',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-600/50',
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
    if (!username.trim() || !pin.trim()) {
      setErrorMessage('Username dan PIN wajib diisi.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setIsRateLimited(false);

    try {
      await login(username.trim(), pin.trim());
      // Navigate on success
      const from = (location.state as any)?.from?.pathname;
      if (from && from !== '/login') {
        navigate(from, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 429) {
        setIsRateLimited(true);
        setErrorMessage(err.message || 'Terlalu banyak percobaan login. Tunggu 60 detik.');
      } else {
        setErrorMessage(err.message || 'Nama pengguna atau PIN salah.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 dark:bg-[#070b14] dark:text-slate-100 flex flex-col justify-center items-center p-4 relative transition-colors duration-200">
      <SeoHead
        title="Warung Madura Berkah 24 Jam - Sistem Stok & Kasir Toko"
        description="Aplikasi kasir dan manajemen stok Warung Madura 24 jam untuk pencatatan transaksi penjualan, kontrol inventaris, serta verifikasi penerimaan barang toko."
        noindex={false}
        canonical="https://student1-131481044262.asia-southeast1.run.app/login"
      />

      {/* Top Floating Theme Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-green-400 p-1 shadow-lg shadow-emerald-500/20 overflow-hidden">
            <img
              src="/market-icon.webp"
              alt="Logo Warung Madura"
              className="h-full w-full object-cover rounded-xl"
            />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Warung Madura <span className="text-emerald-600 dark:text-emerald-400">Berkah 24 Jam</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Sistem Manajemen Pengadaan, Inventori Stok & Kasir Toko
          </p>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 text-[11px] font-bold">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Autentikasi & RBAC Aktif (Blok C)
          </div>
        </div>

        {/* Main Card */}
        <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800/90 dark:bg-[#0d1424] p-6 shadow-xl space-y-5 transition-colors">
          {/* Quick Preset Selector */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
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
                    className={`flex flex-col items-center p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/30 dark:bg-emerald-950/60 dark:text-white dark:ring-emerald-500/30'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700/80 dark:bg-[#121b2f] dark:hover:border-slate-600 dark:hover:bg-[#18233c]'
                    }`}
                  >
                    <span className="text-xl mb-1">{acc.icon}</span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate w-full">
                      {acc.name}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-1 border ${acc.badgeColor}`}
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
                    ? 'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950/70 dark:border-amber-800 dark:text-amber-200'
                    : 'bg-rose-50 border-rose-300 text-rose-900 dark:bg-rose-950/70 dark:border-rose-800 dark:text-rose-200'
                }`}
              >
                <span className="text-base shrink-0">{isRateLimited ? '⚠️' : '❌'}</span>
                <div>
                  <p className="font-bold">
                    {isRateLimited ? 'Batas Percobaan Terlampaui' : 'Login Gagal'}
                  </p>
                  <p className="mt-0.5 opacity-90">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Username Input */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Nama Pengguna (Username)
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="cth: pemilik / udin / sari"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 dark:border-slate-700 dark:bg-[#121b2f] dark:text-white dark:placeholder-slate-500 dark:focus:border-emerald-500"
                required
              />
            </div>

            {/* PIN Input */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  PIN Keamanan (Minimal 4 Angka)
                </label>
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
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
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-center text-lg tracking-widest font-mono text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 dark:border-slate-700 dark:bg-[#121b2f] dark:text-white dark:placeholder-slate-600 dark:focus:border-emerald-500"
                  required
                />
              </div>
            </div>

            {/* Numeric Touch Keypad for POS */}
            <div className="pt-1" data-nosnippet aria-hidden="true">
              <div className="grid grid-cols-3 gap-1.5">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleKeypadPress(digit)}
                    className="h-10 rounded-lg border border-slate-200 bg-slate-100 text-sm font-bold text-slate-800 hover:bg-slate-200 dark:border-slate-700/80 dark:bg-[#151f36] dark:text-slate-200 dark:hover:bg-[#1c2946] active:scale-95 transition-all cursor-pointer"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleKeypadPress('clear')}
                  className="h-10 rounded-lg border border-slate-200 bg-slate-100 text-xs font-bold text-slate-500 hover:bg-slate-200 dark:border-slate-700/80 dark:bg-[#151f36] dark:text-slate-400 dark:hover:bg-[#1c2946] active:scale-95 transition-all cursor-pointer"
                >
                  C
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress('0')}
                  className="h-10 rounded-lg border border-slate-200 bg-slate-100 text-sm font-bold text-slate-800 hover:bg-slate-200 dark:border-slate-700/80 dark:bg-[#151f36] dark:text-slate-200 dark:hover:bg-[#1c2946] active:scale-95 transition-all cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress('backspace')}
                  className="h-10 rounded-lg border border-slate-200 bg-slate-100 text-sm font-bold text-slate-500 hover:bg-slate-200 dark:border-slate-700/80 dark:bg-[#151f36] dark:text-slate-400 dark:hover:bg-[#1c2946] active:scale-95 transition-all cursor-pointer"
                >
                  ⌫
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-600/30 dark:shadow-emerald-950/60 transition-all disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2 mt-4 cursor-pointer"
            >
              {loading ? (
                <span data-nosnippet aria-hidden="true" className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Memverifikasi PIN...</span>
                </span>
              ) : (
                <span>Masuk Sekarang →</span>
              )}
            </button>
          </form>
        </div>

        {/* Info Hints Footer */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500 dark:border-slate-800/80 dark:bg-[#0c1220] dark:text-slate-400 space-y-1 text-center shadow-xs">
          <p className="font-bold text-slate-700 dark:text-slate-300">🔑 Panduan Kredensial Cepat:</p>
          <p>
            • <strong>Cak Rofi (Pemilik):</strong> PIN <code>1234</code> (Akses Penuh Master Control & Dashboard)
          </p>
          <p>
            • <strong>Udin (Staf):</strong> PIN <code>1111</code> • <strong>Sari (Staf):</strong> PIN <code>2222</code>
          </p>
        </div>
      </div>
    </div>
  );
}
