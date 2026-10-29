import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ThemeToggle } from './ThemeToggle';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
  pemilikOnly?: boolean;
  permission?: string;
}

const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true, permission: 'VIEW_DASHBOARD' },
  { to: '/stok', label: 'Inventaris Stok', icon: '📦' },
  { to: '/produk', label: 'Produk & Harga', icon: '🏷️' },
  { to: '/pesanan', label: 'Pesanan Pembelian', icon: '📋' },
  { to: '/penjualan/baru', label: 'Kasir Express (POS)', icon: '⚡' },
  { to: '/riwayat-penjualan', label: 'Riwayat Penjualan', icon: '🧾' },
  { to: '/riwayat-stok', label: 'Riwayat Stok', icon: '📜' },
  { to: '/rbac-control', label: 'Master Control RBAC', icon: '🛡️', pemilikOnly: true },
];

function navLinkClass({ isActive }: { isActive: boolean }): string {
  const base =
    'whitespace-nowrap rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold flex items-center justify-between gap-2 transition-all duration-150 border';
  return isActive
    ? `${base} bg-emerald-50 text-emerald-800 border-emerald-200 shadow-xs dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-500/50 dark:shadow-emerald-950/50`
    : `${base} border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#121b2f] dark:hover:text-slate-100`;
}

export function Layout() {
  const { user, role, isPemilik, hasPermission, quickSwitch, logout } = useAuth();
  const navigate = useNavigate();

  const handleQuickSwitch = async (username: string) => {
    await quickSwitch(username);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleNavItems = navItems.filter((item) => {
    if (item.pemilikOnly) return isPemilik;
    if (item.permission) return isPemilik || hasPermission(item.permission);
    return true;
  });

  return (
    <div className="min-h-screen md:flex bg-slate-50 text-slate-800 dark:bg-[#070b14] dark:text-slate-100 transition-colors duration-200">
      {/* Sidebar Navigation */}
      <aside className="border-b border-slate-200 bg-white md:min-h-screen md:w-68 md:shrink-0 md:border-b-0 md:border-r flex flex-col justify-between transition-colors duration-200 dark:border-slate-800/90 dark:bg-[#0c1220]">
        <div>
          {/* Top Brand & Theme Toggle Header */}
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <img
                src="/market-icon.webp"
                alt="Logo Warung Madura"
                className="h-8 w-8 rounded-xl object-cover shadow-xs border border-emerald-500/30"
              />
              <div>
                <p className="text-sm font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                  Warung Madura
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Berkah 24 Jam
                </p>
              </div>
            </div>

            {/* Theme Toggle Pill */}
            <ThemeToggle compact />
          </div>

          {/* Quick Active Identity Box */}
          <div className="mx-3.5 my-3 p-3 rounded-xl bg-slate-50 border border-slate-200/90 dark:bg-[#121a2d] dark:border-slate-800 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Sesi Aktif
              </span>
              <span
                className={`text-[9px] px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider ${
                  !user
                    ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    : isPemilik
                    ? 'bg-purple-100 text-purple-800 border border-purple-200 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-600/50'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-600/50'
                }`}
              >
                {role || 'ANONIM'}
              </span>
            </div>

            <div className="mt-1.5 flex items-center gap-2.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black text-white shrink-0 shadow-xs ${
                  !user
                    ? 'bg-slate-400'
                    : isPemilik
                    ? 'bg-gradient-to-tr from-purple-700 to-indigo-500'
                    : 'bg-gradient-to-tr from-emerald-600 to-green-500'
                }`}
              >
                {!user ? '?' : user.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {user ? user.name : 'Tamu'}
                </p>
                <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                  @{user?.username || 'tamu'}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0 no-scrollbar">
            {visibleNavItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
                <div className="flex items-center gap-2 truncate">
                  <span className="text-sm shrink-0">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </div>
                {item.pemilikOnly && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700 font-extrabold ml-1 shrink-0 dark:bg-purple-950 dark:text-purple-300 border dark:border-purple-800/80">
                    Owner
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Quick Shift Switcher at bottom */}
        <div className="p-3.5 border-t border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-[#0a0f1c] transition-colors">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Ganti Shift Cepat
            </p>
            <span className="text-[10px] text-slate-400 font-mono">1-Klik</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => handleQuickSwitch('pemilik')}
              className={`px-2 py-1.5 rounded-lg text-xs font-bold border text-left flex items-center gap-1.5 transition-all cursor-pointer ${
                user?.username === 'pemilik'
                  ? 'bg-purple-600 text-white border-purple-500 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-[#121a2d] dark:text-slate-300 dark:border-slate-700 dark:hover:bg-[#1a253e]'
              }`}
            >
              <span>👑</span>
              <span className="truncate">Cak Rofi</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickSwitch('udin')}
              className={`px-2 py-1.5 rounded-lg text-xs font-bold border text-left flex items-center gap-1.5 transition-all cursor-pointer ${
                user?.username === 'udin'
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-[#121a2d] dark:text-slate-300 dark:border-slate-700 dark:hover:bg-[#1a253e]'
              }`}
            >
              <span>👤</span>
              <span className="truncate">Udin</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickSwitch('sari')}
              className={`px-2 py-1.5 rounded-lg text-xs font-bold border text-left flex items-center gap-1.5 transition-all cursor-pointer ${
                user?.username === 'sari'
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-[#121a2d] dark:text-slate-300 dark:border-slate-700 dark:hover:bg-[#1a253e]'
              }`}
            >
              <span>👤</span>
              <span className="truncate">Sari</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="px-2 py-1.5 rounded-lg text-xs font-bold border text-left flex items-center gap-1.5 transition-all bg-white text-rose-600 border-rose-200 hover:bg-rose-50 dark:bg-[#121a2d] dark:text-rose-400 dark:border-rose-900/60 dark:hover:bg-rose-950/50 cursor-pointer"
            >
              <span>🚪</span>
              <span className="truncate">Keluar</span>
            </button>
          </div>

          {isPemilik && (
            <button
              type="button"
              onClick={() => navigate('/rbac-control')}
              className="mt-2.5 w-full text-center text-[11px] font-bold text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 py-1 transition-colors"
            >
              Buka Panel Master Control →
            </button>
          )}
        </div>
      </aside>

      {/* Main App Content Viewport */}
      <main className="min-w-0 flex-1 p-4 md:p-8 bg-slate-50 dark:bg-[#070b14] transition-colors duration-200">
        <Outlet />
      </main>
    </div>
  );
}
