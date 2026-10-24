import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  pemilikOnly?: boolean;
  permission?: string;
}

const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', end: true, permission: 'VIEW_DASHBOARD' },
  { to: '/stok', label: 'Inventaris Stok' },
  { to: '/produk', label: 'Produk' },
  { to: '/pesanan', label: 'Pesanan Pembelian' },
  { to: '/penjualan/baru', label: 'Penjualan Baru' },
  { to: '/riwayat-penjualan', label: 'Riwayat Penjualan' },
  { to: '/riwayat-stok', label: 'Riwayat Stok' },
  { to: '/rbac-control', label: '🛡️ Master Control RBAC', pemilikOnly: true },
];

function navLinkClass({ isActive }: { isActive: boolean }): string {
  const base = 'whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium flex items-center justify-between';
  return isActive
    ? `${base} bg-green-50 text-green-700 font-semibold`
    : `${base} text-slate-600 hover:bg-slate-100 hover:text-slate-900`;
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
    <div className="min-h-screen md:flex bg-slate-50">
      <aside className="border-b border-slate-200 bg-white md:min-h-screen md:w-64 md:shrink-0 md:border-b-0 md:border-r flex flex-col justify-between">
        <div>
          <div className="px-5 py-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <img src="/market-icon.jpg" alt="Logo" className="h-6 w-6 rounded-md object-cover shadow-xs inline-block" /> Warung Madura
              </p>
              <p className="text-xs text-slate-500 font-medium">Stock Manager • Berkah 24 Jam</p>
            </div>
          </div>

          {/* Quick Identity Indicator inside sidebar */}
          <div className="mx-3 my-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Sesi Login Aktif
            </span>
            <div className="mt-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${
                    !user ? 'bg-slate-400' : isPemilik ? 'bg-purple-600' : 'bg-emerald-600'
                  }`}
                >
                  {!user ? '?' : user.name.charAt(0)}
                </div>
                <div className="leading-tight">
                  <p className="text-xs font-bold text-slate-800 truncate max-w-[110px]">
                    {user ? user.name : 'Tamu (Anonim)'}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-500">
                    {!user ? '401 Denied' : user.role}
                  </p>
                </div>
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  !user
                    ? 'bg-slate-200 text-slate-700'
                    : isPemilik
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {role || 'ANONIM'}
              </span>
            </div>
          </div>

          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
            {visibleNavItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
                <span>{item.label}</span>
                {item.pemilikOnly && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 font-semibold ml-1">
                    Owner
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Quick User Switcher Pills at bottom of sidebar */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/50">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Ganti Peran Cepat (Quick Switch)
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => handleQuickSwitch('pemilik')}
              className={`px-2 py-1.5 rounded text-xs font-medium border text-left flex items-center gap-1.5 transition-all ${
                user?.username === 'pemilik'
                  ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>👑</span>
              <span className="truncate">Cak Rofi</span>
            </button>
            <button
              onClick={() => handleQuickSwitch('udin')}
              className={`px-2 py-1.5 rounded text-xs font-medium border text-left flex items-center gap-1.5 transition-all ${
                user?.username === 'udin'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>👤</span>
              <span className="truncate">Udin</span>
            </button>
            <button
              onClick={() => handleQuickSwitch('sari')}
              className={`px-2 py-1.5 rounded text-xs font-medium border text-left flex items-center gap-1.5 transition-all ${
                user?.username === 'sari'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>👤</span>
              <span className="truncate">Sari</span>
            </button>
            <button
              onClick={handleLogout}
              className="px-2 py-1.5 rounded text-xs font-medium border text-left flex items-center gap-1.5 transition-all bg-white text-red-600 border-red-200 hover:bg-red-50"
            >
              <span>🚪</span>
              <span className="truncate">Keluar</span>
            </button>
          </div>
          {isPemilik && (
            <button
              onClick={() => navigate('/rbac-control')}
              className="mt-2 w-full text-center text-[11px] font-semibold text-purple-700 hover:text-purple-900 hover:underline py-1"
            >
              Buka Panel Master Control →
            </button>
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}

