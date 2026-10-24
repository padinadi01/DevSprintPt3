import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import {
  apiListUsers,
  apiGetRbacMatrix,
  apiUpdateUserRole,
  apiUpdateUserPin,
  apiCreateUser,
  apiUpdateUserPermissions,
  PERMISSIONS_DEF,
  type UserListItem,
  type RbacMatrixItem,
  type UserRole,
} from '../api/auth';
import { request, ApiError } from '../api/http';
import { PageHeader } from '../components/PageHeader';
import { btnPrimary, btnSecondary, btnDanger } from '../components/ui';
import { useToast } from '../components/ToastProvider';

interface ProbeResult {
  name: string;
  endpoint: string;
  method: string;
  status: number;
  statusText: string;
  expectedStatus: string;
  passed: boolean;
  timeMs: number;
  message?: string;
}

export function RbacControlPage() {
  const { user, role, isPemilik, quickSwitch, login, logout, refreshUser } = useAuth();
  const toast = useToast();

  const [users, setUsers] = useState<UserListItem[]>([]);
  const [matrix, setMatrix] = useState<RbacMatrixItem[]>([]);
  const [principles, setPrinciples] = useState<string[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Probe testing state
  const [probing, setProbing] = useState(false);
  const [probeResults, setProbeResults] = useState<ProbeResult[]>([]);

  // Manual PIN login form state
  const [showManualLogin, setShowManualLogin] = useState(false);
  const [manualUsername, setManualUsername] = useState('pemilik');
  const [manualPin, setManualPin] = useState('1234');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Create user form state
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('STAF');

  // Change PIN modal state
  const [pinModalUser, setPinModalUser] = useState<UserListItem | null>(null);
  const [editPinValue, setEditPinValue] = useState('');

  // Staff Permissions modal state
  const [permModalUser, setPermModalUser] = useState<UserListItem | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [savingPermissions, setSavingPermissions] = useState(false);

  const loadData = async () => {
    if (!user) {
      setUsers([]);
      return;
    }
    setLoadingUsers(true);
    try {
      const matrixRes = await apiGetRbacMatrix();
      setMatrix(matrixRes.matrix);
      setPrinciples(matrixRes.principles);

      const userList = await apiListUsers();
      setUsers(userList);
    } catch (err: any) {
      // If 403 or 401, keep matrix fallback
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Handle Quick Switch
  const handleSwitch = async (username: string) => {
    try {
      await quickSwitch(username);
      toast.success(`Berhasil beralih identitas ke: ${username}`);
    } catch (err: any) {
      toast.error(err.message || 'Gagal beralih identitas');
    }
  };

  // Handle Manual PIN Login
  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      await login(manualUsername, manualPin);
      toast.success(`Login berhasil sebagai: ${manualUsername}`);
      setShowManualLogin(false);
    } catch (err: any) {
      setLoginError(err.message || 'Login gagal');
      toast.error(err.message || 'Login gagal');
    }
  };

  // Handle Change Role (NGUBAH AUTHORIZE)
  const handleChangeRole = async (targetUser: UserListItem, newRole: UserRole) => {
    if (!isPemilik) {
      toast.error('Hanya Pemilik yang berhak mengubah peran!');
      return;
    }
    try {
      await apiUpdateUserRole(targetUser.id, newRole);
      toast.success(
        `Peran pengguna "${targetUser.name}" berhasil diubah menjadi ${newRole}`,
      );
      await loadData();
      await refreshUser();
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengubah peran pengguna');
    }
  };

  // Handle Change PIN
  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinModalUser) return;
    try {
      await apiUpdateUserPin(pinModalUser.id, editPinValue);
      toast.success(`PIN untuk "${pinModalUser.name}" berhasil diperbarui`);
      setPinModalUser(null);
      setEditPinValue('');
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengubah PIN');
    }
  };

  // Handle Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingUser(true);
    try {
      const created = await apiCreateUser({
        username: newUsername,
        name: newName,
        pin: newPin,
        role: newRole,
      });
      toast.success(`Pengguna baru "${newName}" berhasil ditambahkan!`);
      setShowCreateUser(false);
      setNewUsername('');
      setNewName('');
      setNewPin('');
      setUsers((prev) => [...prev, created]);
      apiListUsers().then(setUsers).catch(() => {});
    } catch (err: any) {
      toast.error(err.message || 'Gagal menambahkan pengguna baru');
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Handle Staff Permissions
  const handleOpenPermissions = (u: UserListItem) => {
    setPermModalUser(u);
    setSelectedPermissions(u.permissions || []);
  };

  const togglePermission = (permKey: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permKey) ? prev.filter((p) => p !== permKey) : [...prev, permKey]
    );
  };

  const handleSelectAllPermissions = () => {
    setSelectedPermissions(PERMISSIONS_DEF.map((p) => p.key));
  };

  const handleClearAllPermissions = () => {
    setSelectedPermissions([]);
  };

  const handleSavePermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permModalUser) return;
    setSavingPermissions(true);
    try {
      await apiUpdateUserPermissions(permModalUser.id, selectedPermissions);
      toast.success(`Hak akses staf untuk "${permModalUser.name}" berhasil diperbarui!`);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === permModalUser.id ? { ...u, permissions: selectedPermissions } : u
        )
      );
      if (permModalUser.id === user?.id) {
        await refreshUser();
      }
      setPermModalUser(null);
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan hak akses staf');
    } finally {
      setSavingPermissions(false);
    }
  };

  // Run Live Permission Probe
  const runLiveProbe = async () => {
    setProbing(true);
    setProbeResults([]);

    const tests = [
      {
        name: 'Lihat Katalog & Stok Produk',
        endpoint: '/products',
        method: 'GET',
        expectedPemilik: 200,
        expectedStaf: 200,
        expectedAnonim: 401,
      },
      {
        name: 'Lihat Riwayat Mutasi Stok',
        endpoint: '/stock-movements',
        method: 'GET',
        expectedPemilik: 200,
        expectedStaf: 200,
        expectedAnonim: 401,
      },
      {
        name: 'Akses Dashboard Finansial (Omset & Margin)',
        endpoint: '/dashboard',
        method: 'GET',
        expectedPemilik: 200,
        expectedStaf: 403,
        expectedAnonim: 401,
      },
      {
        name: 'Buat Pesanan Pembelian (PO)',
        endpoint: '/purchase-orders',
        method: 'POST',
        body: { supplierId: '00000000-0000-0000-0000-000000000000', orderDate: new Date().toISOString(), items: [] },
        expectedPemilik: 400, // or 404/201 depending on validation; Staf will be 403!
        expectedStaf: 403,
        expectedAnonim: 401,
      },
      {
        name: 'Koreksi Stok Opname (Stock Adjustment)',
        endpoint: '/stock-adjustments',
        method: 'POST',
        body: { productId: '00000000-0000-0000-0000-000000000000', reason: 'Uji probe', oldQty: 0, newQty: 1 },
        expectedPemilik: 404, // product not found vs Staf 403
        expectedStaf: 403,
        expectedAnonim: 401,
      },
    ];

    const results: ProbeResult[] = [];

    for (const test of tests) {
      const start = performance.now();
      let status = 0;
      let statusText = '';
      let message = '';

      try {
        await request(test.endpoint, {
          method: test.method as any,
          body: test.body,
        });
        status = 200;
        statusText = 'OK';
      } catch (err: any) {
        if (err instanceof ApiError) {
          status = err.status;
          statusText = err.code;
          message = err.message;
        } else {
          status = 500;
          statusText = 'ERROR';
          message = err.message;
        }
      }

      const elapsed = Math.round(performance.now() - start);

      // Determine expected
      let expected = 200;
      let expectedStr = '';
      if (!user) {
        expected = test.expectedAnonim;
        expectedStr = '401 Unauthorized';
      } else if (role === 'PEMILIK') {
        expected = test.expectedPemilik;
        expectedStr = expected === 200 ? '200 OK' : `${expected} (Diizinkan, Validasi)`;
      } else {
        expected = test.expectedStaf;
        expectedStr = `${expected} ${expected === 403 ? 'Forbidden' : 'OK'}`;
      }

      const passed =
        role === 'PEMILIK'
          ? status !== 401 && status !== 403 // Pemilik is never 401/403
          : status === expected;

      results.push({
        name: test.name,
        endpoint: `${test.method} /api${test.endpoint}`,
        method: test.method,
        status,
        statusText: status === 200 ? '200 OK' : `${status} ${statusText}`,
        expectedStatus: expectedStr,
        passed,
        timeMs: elapsed,
        message,
      });
    }

    setProbeResults(results);
    setProbing(false);
  };

  if (!isPemilik) {
    return (
      <div className="space-y-6 max-w-xl mx-auto py-12">
        <PageHeader
          title="Master Control RBAC"
          description="Pusat kendali hak akses dan otorisasi pengguna."
        />
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm space-y-5">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-50 text-4xl border border-amber-200">
            🔒
          </div>
          <div className="space-y-2">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
              403 FORBIDDEN • HANYA PEMILIK
            </span>
            <h2 className="text-xl font-bold text-slate-900">
              Akses Master Control Dibatasi
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Halaman Master Control RBAC hanya dapat diakses oleh akun <strong>PEMILIK (Owner)</strong>. Pengguna dengan peran <strong>{user?.role || 'STAF'}</strong> dilarang mengubah otorisasi atau melihat konfigurasi hak akses pengguna lain demi keamanan sistem (*Deny by Default*).
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs text-slate-600 space-y-1 text-left">
            <p className="font-semibold text-slate-700">Informasi Sesi Saat Ini:</p>
            <p>• Nama Pengguna: <strong>{user?.name || 'Tamu'}</strong> (@{user?.username || 'anonim'})</p>
            <p>• Peran Aktif: <strong className="text-amber-700">{user?.role || 'ANONIM'}</strong></p>
            <p>• Status Hak Akses: <strong className="text-red-600">Ditolak (403 Forbidden)</strong></p>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
            <button
              onClick={() => handleSwitch('pemilik')}
              className={btnPrimary}
            >
              👑 Beralih ke Cak Rofi (Pemilik)
            </button>
            <button
              onClick={() => logout()}
              className={btnSecondary}
            >
              🚪 Keluar / Ganti Akun
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        title="Master Control RBAC & Otorisasi Pengguna"
        description="Pusat kendali autentikasi dan otorisasi hak akses (Role-Based Access Control) Warung Madura Berkah 24 Jam."
      />

      {/* 1. KARTU IDENTITAS AKTIF & QUICK SWITCHER */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Identitas Aktif Saat Ini
            </span>
            <div className="mt-1 flex items-center gap-3">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white ${
                  !user
                    ? 'bg-slate-400'
                    : isPemilik
                    ? 'bg-purple-600'
                    : 'bg-emerald-600'
                }`}
              >
                {!user ? '?' : user.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {user ? user.name : 'Tamu / Anonim (Belum Login)'}
                </h3>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${
                      !user
                        ? 'bg-slate-100 text-slate-600'
                        : isPemilik
                        ? 'bg-purple-100 text-purple-800 border border-purple-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    {!user ? 'ANONIM' : `PERAN: ${user.role}`}
                  </span>
                  {user && (
                    <span className="text-xs text-slate-500">
                      Username: <code className="font-mono text-slate-700">@{user.username}</code>
                    </span>
                  )}
                  {user?.receiverId && (
                    <span className="text-xs text-slate-500">
                      • Penerima Terikat: <strong className="text-slate-700">{user.name}</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowManualLogin(!showManualLogin)}
              className={btnSecondary}
            >
              {showManualLogin ? 'Tutup Form Login PIN' : '🔑 Login dengan PIN'}
            </button>
            {user && (
              <button onClick={logout} className={btnDanger}>
                🚪 Keluar (Simulasi Tamu)
              </button>
            )}
          </div>
        </div>

        {/* Form Login Manual dengan PIN */}
        {showManualLogin && (
          <form
            onSubmit={handleManualLogin}
            className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 transition-all"
          >
            <h4 className="text-sm font-semibold text-slate-800">Uji Autentikasi Login PIN (C2 & C7)</h4>
            <p className="text-xs text-slate-500 mb-3">
              Masukkan username dan PIN. Gagal $\ge 5$ kali berturut-turut akan memicu rate limiter (HTTP 429).
            </p>
            {loginError && (
              <div className="mb-3 rounded bg-red-50 p-2.5 text-xs font-medium text-red-700 border border-red-200">
                {loginError}
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="Username (pemilik / udin / sari)"
                value={manualUsername}
                onChange={(e) => setManualUsername(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                required
              />
              <input
                type="password"
                placeholder="PIN (cth: 1234)"
                value={manualPin}
                onChange={(e) => setManualPin(e.target.value)}
                className="w-32 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                required
              />
              <button type="submit" className={btnPrimary}>
                Masuk
              </button>
            </div>
          </form>
        )}

        {/* QUICK SWITCHER BUTTONS */}
        <div className="mt-6 border-t border-slate-100 pt-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Quick Switch Identitas Pengguna (1-Click Switcher)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => handleSwitch('pemilik')}
              className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                user?.username === 'pemilik'
                  ? 'border-purple-500 bg-purple-50 shadow-sm'
                  : 'border-slate-200 hover:border-purple-300 hover:bg-slate-50'
              }`}
            >
              <span className="text-2xl">👑</span>
              <div>
                <p className="text-sm font-bold text-slate-900">Cak Rofi</p>
                <p className="text-xs text-purple-700 font-semibold">PEMILIK (PIN 1234)</p>
                <p className="text-[11px] text-slate-500">Akses penuh seluruh modul</p>
              </div>
            </button>

            <button
              onClick={() => handleSwitch('udin')}
              className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                user?.username === 'udin'
                  ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                  : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
              }`}
            >
              <span className="text-2xl">👤</span>
              <div>
                <p className="text-sm font-bold text-slate-900">Udin</p>
                <p className="text-xs text-emerald-700 font-semibold">STAF (PIN 1111)</p>
                <p className="text-[11px] text-slate-500">Penerima barang & kasir</p>
              </div>
            </button>

            <button
              onClick={() => handleSwitch('sari')}
              className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                user?.username === 'sari'
                  ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                  : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
              }`}
            >
              <span className="text-2xl">👤</span>
              <div>
                <p className="text-sm font-bold text-slate-900">Sari</p>
                <p className="text-xs text-emerald-700 font-semibold">STAF (PIN 2222)</p>
                <p className="text-[11px] text-slate-500">Penerima barang & kasir</p>
              </div>
            </button>

            <button
              onClick={logout}
              className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                !user
                  ? 'border-slate-500 bg-slate-100 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span className="text-2xl">🚪</span>
              <div>
                <p className="text-sm font-bold text-slate-900">Tamu (Anonim)</p>
                <p className="text-xs text-slate-600 font-semibold">TANPA TOKEN (401)</p>
                <p className="text-[11px] text-slate-500">Simulasi request ditolak</p>
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* 2. UJI PROBE API REAL-TIME */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              ⚡ Simulator Uji Izin API Live (Real-Time RBAC Probe)
            </h3>
            <p className="text-xs text-slate-500">
              Mengirim request HTTP sungguhan ke server backend dengan token pengguna aktif untuk memverifikasi respon status (200 / 401 / 403).
            </p>
          </div>
          <button
            onClick={runLiveProbe}
            disabled={probing}
            className={`${btnPrimary} flex items-center gap-2`}
          >
            {probing ? '⏳ Menguji Endpoint...' : '🚀 Jalankan Uji Live Sekarang'}
          </button>
        </div>

        {probeResults.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="py-2.5 px-3 text-left font-semibold">Aksi / Fitur</th>
                  <th className="py-2.5 px-3 text-left font-semibold">Endpoint</th>
                  <th className="py-2.5 px-3 text-left font-semibold">Status Diharapkan</th>
                  <th className="py-2.5 px-3 text-left font-semibold">Status Riil Server</th>
                  <th className="py-2.5 px-3 text-left font-semibold">Latency</th>
                  <th className="py-2.5 px-3 text-left font-semibold">Evaluasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {probeResults.map((p, idx) => (
                  <tr key={idx} className={p.passed ? 'bg-green-50/30' : 'bg-red-50/30'}>
                    <td className="py-2 px-3 font-medium text-slate-900">{p.name}</td>
                    <td className="py-2 px-3 font-mono text-xs text-slate-600">{p.endpoint}</td>
                    <td className="py-2 px-3 text-xs font-semibold text-slate-700">{p.expectedStatus}</td>
                    <td className="py-2 px-3 font-mono text-xs">
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-bold ${
                          p.status === 200 || p.status === 201
                            ? 'bg-green-100 text-green-800'
                            : p.status === 403
                            ? 'bg-amber-100 text-amber-800'
                            : p.status === 401
                            ? 'bg-red-100 text-red-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {p.statusText}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-xs text-slate-500">{p.timeMs} ms</td>
                    <td className="py-2 px-3 text-xs font-bold">
                      {p.passed ? (
                        <span className="text-green-600">✓ LOLOS</span>
                      ) : (
                        <span className="text-red-600">✗ TIDAK SESUAI</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 3. MODUL NGUBAH-NGUBAH AUTHORIZE & PENGGUNA (RBAC MASTERCONTROL) */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                ⚙️ Manajemen Pengguna & Pengubahan Hak Akses (RBAC Master Control)
              </h3>
              <span className="rounded bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide">
                Wewenang Pemilik
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Ubah peran pengguna (promosi Staf → Pemilik atau sebaliknya), perbarui PIN rahasia, atau buat akun staf baru.
            </p>
          </div>

          {isPemilik && (
            <button
              onClick={() => setShowCreateUser(!showCreateUser)}
              className={btnPrimary}
            >
              + Tambah Pengguna Baru
            </button>
          )}
        </div>

        {!isPemilik && (
          <div className="mt-4 rounded-lg bg-amber-50 p-4 border border-amber-200 text-amber-800 text-sm">
            <p className="font-bold flex items-center gap-2">
              🔒 Hak Akses Pengubahan Terkunci
            </p>
            <p className="text-xs mt-1 text-amber-700">
              Kamu saat ini masuk sebagai <strong>{user?.role || 'Tamu'}</strong>. Modul pengubahan peran dan modifikasi otorisasi hanya dapat dioperasikan oleh <strong>PEMILIK</strong> (Deny by Default). Silakan beralih ke Cak Rofi untuk mengubah data pengguna.
            </p>
          </div>
        )}

        {/* Form Tambah Pengguna Baru */}
        {showCreateUser && isPemilik && (
          <form
            onSubmit={handleCreateUser}
            className="mt-4 rounded-lg border border-purple-200 bg-purple-50/40 p-4"
          >
            <h4 className="text-sm font-bold text-purple-900 mb-3">Buat Pengguna / Karyawan Baru</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Username</label>
                <input
                  type="text"
                  placeholder="cth: budi"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Nama Lengkap</label>
                <input
                  type="text"
                  placeholder="cth: Budi Santoso"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">PIN (Min. 4 angka)</label>
                <input
                  type="password"
                  placeholder="cth: 3333"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Peran Awal</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm bg-white"
                >
                  <option value="STAF">STAF (Operasional)</option>
                  <option value="PEMILIK">PEMILIK (Akses Penuh)</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateUser(false)}
                className={btnSecondary}
                disabled={isCreatingUser}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isCreatingUser}
                className={`${btnPrimary} flex items-center justify-center gap-2 disabled:opacity-50`}
              >
                {isCreatingUser ? (
                  <>
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  'Simpan Pengguna'
                )}
              </button>
            </div>
          </form>
        )}

        {/* Tabel Daftar Pengguna & Ubah Peran */}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="py-3 px-3 text-left font-semibold">Pengguna</th>
                <th className="py-3 px-3 text-left font-semibold">Username</th>
                <th className="py-3 px-3 text-left font-semibold">Peran Otorisasi</th>
                <th className="py-3 px-3 text-left font-semibold">Penerima Barang</th>
                <th className="py-3 px-3 text-right font-semibold">Aksi Otorisasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loadingUsers ? (
                <tr data-nosnippet aria-hidden="true">
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    Memuat data pengguna...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    Tidak ada pengguna yang terdaftar atau belum login sebagai Pemilik.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-3 font-medium text-slate-900 flex items-center gap-2">
                      <span className="font-bold">{u.name}</span>
                      {u.id === user?.id && (
                        <span className="rounded bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5">
                          Kamu
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600">@{u.username}</td>
                    <td className="py-3 px-3">
                      <div className="flex flex-col gap-1 items-start">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            u.role === 'PEMILIK'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {u.role}
                        </span>
                        {u.role === 'PEMILIK' ? (
                          <span className="text-[10px] text-purple-600 font-medium">Akses Penuh (Owner)</span>
                        ) : u.permissions && u.permissions.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-0.5 max-w-[260px]">
                            {u.permissions.map((p) => {
                              const def = PERMISSIONS_DEF.find((d) => d.key === p);
                              return (
                                <span
                                  key={p}
                                  className="inline-block bg-indigo-50 text-indigo-700 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-indigo-200"
                                >
                                  {def?.badge || p}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Standar (Operasional Kasir)</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-600">
                      {u.receiver?.name || <span className="italic text-slate-400">-</span>}
                    </td>
                    <td className="py-3 px-3 text-right space-x-2">
                      {isPemilik ? (
                        <>
                          <button
                            onClick={() => handleOpenPermissions(u)}
                            className="rounded border border-indigo-300 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                            title="Atur hak akses / izin granular untuk akun ini"
                          >
                            🛡️ Hak Akses
                          </button>
                          <button
                            onClick={() =>
                              handleChangeRole(
                                u,
                                u.role === 'PEMILIK' ? 'STAF' : 'PEMILIK'
                              )
                            }
                            className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            title="Ubah peran antara Pemilik dan Staf"
                          >
                            Ubah → {u.role === 'PEMILIK' ? 'STAF' : 'PEMILIK'}
                          </button>
                          <button
                            onClick={() => {
                              setPinModalUser(u);
                              setEditPinValue('');
                            }}
                            className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            🔑 Ganti PIN
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Hanya Pemilik</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal Ubah PIN */}
      {pinModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h4 className="text-base font-bold text-slate-900">
              Ganti PIN Pengguna: {pinModalUser.name}
            </h4>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              PIN baru akan otomatis di-hash menggunakan <code>bcrypt</code> sebelum disimpan di database.
            </p>
            <form onSubmit={handleSavePin} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700">PIN Baru</label>
                <input
                  type="password"
                  placeholder="Minimal 4 karakter"
                  value={editPinValue}
                  onChange={(e) => setEditPinValue(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPinModalUser(null)}
                  className={btnSecondary}
                >
                  Batal
                </button>
                <button type="submit" className={btnPrimary}>
                  Simpan PIN Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Atur Hak Akses Staf */}
      {permModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between border-b pb-3">
              <div>
                <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>🛡️</span> Atur Hak Akses: {permModalUser.name}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  @{permModalUser.username} • Peran:{' '}
                  <span
                    className={`font-bold ${
                      permModalUser.role === 'PEMILIK' ? 'text-purple-700' : 'text-emerald-700'
                    }`}
                  >
                    {permModalUser.role}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPermModalUser(null)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                ✕
              </button>
            </div>

            {permModalUser.role === 'PEMILIK' ? (
              <div className="rounded-lg bg-purple-50 p-4 border border-purple-200 text-purple-900 text-xs">
                <p className="font-bold">👑 Akun Pemilik Memiliki Akses Penuh (Superadmin)</p>
                <p className="mt-1 text-purple-700 leading-relaxed">
                  Akun dengan peran <strong>PEMILIK</strong> secara default memiliki wewenang penuh tanpa batas di semua fitur dan endpoint API. Pemberian izin khusus ini utamanya ditujukan untuk akun staf yang membutuhkan delegasi wewenang tertentu.
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-blue-50 p-3 border border-blue-200 text-blue-900 text-xs">
                <p className="font-semibold">💡 Otorisasi Granular / Delegasi Wewenang Staff</p>
                <p className="mt-0.5 text-blue-700">
                  Secara default (Deny by Default), akun Staf hanya memiliki akses kasir & penerimaan barang standar. Centang izin di bawah ini untuk mendelegasikan wewenang khusus kepada <strong>{permModalUser.name}</strong>.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-semibold text-slate-700">
                Pilih Izin Akses ({selectedPermissions.length} terpilih):
              </span>
              <div className="space-x-2">
                <button
                  type="button"
                  onClick={handleSelectAllPermissions}
                  className="text-indigo-600 hover:text-indigo-800 font-semibold underline text-[11px]"
                >
                  Pilih Semua
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={handleClearAllPermissions}
                  className="text-slate-500 hover:text-slate-700 font-semibold underline text-[11px]"
                >
                  Reset (Hapus Semua)
                </button>
              </div>
            </div>

            <form onSubmit={handleSavePermissions} className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div className="space-y-2.5">
                {PERMISSIONS_DEF.map((perm) => {
                  const isChecked = selectedPermissions.includes(perm.key);
                  return (
                    <label
                      key={perm.key}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        isChecked
                          ? 'border-indigo-400 bg-indigo-50/60 shadow-sm'
                          : 'border-slate-200 bg-slate-50/40 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => togglePermission(perm.key)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{perm.label}</span>
                          <span className="font-mono text-[10px] text-slate-400">({perm.key})</span>
                        </div>
                        <p className="text-slate-600 mt-0.5 leading-relaxed">{perm.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setPermModalUser(null)}
                  className={btnSecondary}
                  disabled={savingPermissions}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={btnPrimary}
                  disabled={savingPermissions}
                >
                  {savingPermissions ? 'Menyimpan...' : '💾 Simpan Hak Akses'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. MATRIKS RESMI RBAC */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-900">
          📋 Matriks Hak Akses Resmi Warung Madura
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Matriks ini diterapkan langsung pada lapisan otorisasi Express middleware (Deny by default).
        </p>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="py-2.5 px-3 text-left font-semibold">Modul</th>
                <th className="py-2.5 px-3 text-left font-semibold">Aksi / Fitur</th>
                <th className="py-2.5 px-3 text-left font-semibold">Endpoint API</th>
                <th className="py-2.5 px-3 text-left font-semibold">Pemilik</th>
                <th className="py-2.5 px-3 text-left font-semibold">Staf</th>
                <th className="py-2.5 px-3 text-left font-semibold">Penjelasan Aturan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {matrix.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 font-semibold text-slate-800">{row.module}</td>
                  <td className="py-2.5 px-3 font-medium text-slate-900">{row.action}</td>
                  <td className="py-2.5 px-3 font-mono text-xs text-slate-600">{row.endpoint}</td>
                  <td className="py-2.5 px-3">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800">
                      {row.pemilik}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                        row.staf.includes('Boleh')
                          ? 'bg-green-100 text-green-800'
                          : row.staf.includes('Ditolak')
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {row.staf}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-xs text-slate-500">{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {principles.length > 0 && (
          <div className="mt-6 rounded-lg bg-slate-50 p-4 border border-slate-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Prinsip Keamanan RBAC (Slide Panduan Blok C)
            </h4>
            <ul className="list-disc list-inside space-y-1 text-xs text-slate-700">
              {principles.map((pr, i) => (
                <li key={i}>{pr}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
