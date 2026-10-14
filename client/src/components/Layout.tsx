import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { listAccessUsers, type ManagedUser } from '../api/access';
import { useAuth } from '../contexts/AuthContext';

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  permissions: string[];
}

const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', end: true, permissions: ['dashboard.view'] },
  { to: '/produk', label: 'Produk', permissions: ['products.view'] },
  { to: '/penjualan/baru', label: 'Penjualan Baru', permissions: ['sales.create'] },
  { to: '/riwayat-penjualan', label: 'Riwayat Penjualan', permissions: ['sales.view.all', 'sales.view.own'] },
  { to: '/riwayat-stok', label: 'Riwayat Stok', permissions: ['stock.view'] },
  { to: '/restock', label: 'Restock Barang', permissions: ['restock.view'] },
  { to: '/inventory', label: 'Stok Opname', permissions: ['inventory.view'] },
  { to: '/pengaturan/akses', label: 'Akses & Pengguna', permissions: ['users.manage', 'roles.manage'] },
];

function navLinkClass({ isActive }: { isActive: boolean }): string {
  const base = 'whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium';
  return isActive
    ? `${base} bg-green-50 text-green-700`
    : `${base} text-slate-600 hover:bg-slate-100 hover:text-slate-900`;
}

export function Layout() {
  const { user, hasAnyPermission, logout, quickSwitch, returnToOwner } = useAuth();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState('');
  const [switchError, setSwitchError] = useState('');
  const [switchUsers, setSwitchUsers] = useState<ManagedUser[]>([]);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  async function openSwitcher() {
    setSwitchError('');
    if (switcherOpen) {
      setSwitcherOpen(false);
      return;
    }
    try {
      const users = await listAccessUsers();
      setSwitchUsers(users.filter((candidate) => candidate.isActive && candidate.role.name !== 'Pemilik'));
      setSwitcherOpen(true);
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : 'Gagal memuat akun pengguna.');
    }
  }

  async function handleQuickSwitch(targetUserId: string) {
    if (!targetUserId) return;
    setSwitching(true);
    setSwitchError('');
    try {
      await quickSwitch(targetUserId);
      setSwitcherOpen(false);
      navigate('/', { replace: true });
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : 'Gagal beralih akun.');
    } finally {
      setSwitching(false);
    }
  }

  async function handleReturnToOwner() {
    setSwitching(true);
    setSwitchError('');
    try {
      await returnToOwner();
      navigate('/', { replace: true });
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : 'Gagal kembali ke akun Pemilik.');
    } finally {
      setSwitching(false);
    }
  }

  async function handleLogout() {
    setLogoutError('');
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : 'Gagal keluar.');
    }
  }

  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-slate-200 bg-white md:min-h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="px-4 py-4 md:py-6">
          <p className="text-base font-semibold text-slate-900">Warung Madura</p>
          <p className="text-xs text-slate-500">Stock Manager</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {navItems.filter((item) => hasAnyPermission(item.permissions)).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-8">
          <div>
            <p className="text-sm font-medium text-slate-900">{user?.displayName}</p>
            <p className="text-xs text-slate-500">{user?.role.name} · @{user?.username}</p>
          </div>
          <button type="button" onClick={() => void handleLogout()}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Keluar
          </button>
          {user?.role.name === 'Pemilik' && !user.isImpersonating && (
            <div className="relative">
              <button type="button" onClick={() => void openSwitcher()} disabled={switching}
                className="rounded-md border border-green-700 px-3 py-2 text-sm font-medium text-green-800 hover:bg-green-50">
                {switcherOpen ? 'Tutup daftar akun' : 'Beralih akun'}
              </button>
              {switcherOpen && (
                <div className="absolute right-0 z-10 mt-2 w-72 rounded-md border border-slate-200 bg-white p-3 shadow-lg">
                  <label htmlFor="quick-switch-user" className="mb-2 block text-xs font-medium text-slate-600">
                    Pilih akun aktif (tanpa PIN akun tujuan)
                  </label>
                  <select id="quick-switch-user" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    defaultValue="" disabled={switching}
                    onChange={(event) => void handleQuickSwitch(event.target.value)}>
                    <option value="" disabled>Pilih pengguna</option>
                    {switchUsers.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.displayName} · @{candidate.username} ({candidate.role.name})
                      </option>
                    ))}
                  </select>
                  {switchUsers.length === 0 && (
                    <p className="mt-2 text-xs text-slate-500">Belum ada akun non-Pemilik yang aktif.</p>
                  )}
                  <p className="mt-2 text-xs text-amber-800">
                    Kamu akan memakai izin dan identitas operasional akun yang dipilih.
                  </p>
                </div>
              )}
            </div>
          )}
          {user?.isImpersonating && (
            <button type="button" onClick={() => void handleReturnToOwner()} disabled={switching}
              className="rounded-md border border-amber-500 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100">
              {switching ? 'Memproses...' : 'Kembali ke Pemilik'}
            </button>
          )}
          {logoutError && <p role="alert" className="basis-full text-sm text-red-700">{logoutError}</p>}
          {switchError && <p role="alert" className="basis-full text-sm text-red-700">{switchError}</p>}
        </header>
        {user?.isImpersonating && (
          <div role="status" className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950 md:px-8">
            Mode beralih akun aktif. Kamu memakai izin dan identitas operasional @{user.username}; tindakan akan tercatat atas nama akun tersebut. Kembali ke akun Pemilik setelah selesai.
          </div>
        )}
        <div className="p-4 md:p-8"><Outlet /></div>
      </main>
    </div>
  );
}
