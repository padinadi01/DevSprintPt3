import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  addAccessRole,
  addAccessUser,
  editAccessRole,
  editAccessUser,
  listAccessPermissions,
  listAccessRoles,
  listAccessUsers,
  removeAccessRole,
  resetAccessPin,
  type AccessPermission,
  type AccessRole,
  type ManagedUser,
} from '../api/access';
import { getErrorMessage } from '../api/http';
import { PageHeader } from '../components/PageHeader';
import { btnDanger, btnPrimary, btnSecondary, cardClass, inputClass, labelClass } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';

export function AccessPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<AccessRole[]>([]);
  const [permissions, setPermissions] = useState<AccessPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pin, setPin] = useState('');
  const [roleId, setRoleId] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [newRolePermissions, setNewRolePermissions] = useState<string[]>([]);
  const [pinUser, setPinUser] = useState('');
  const [newPin, setNewPin] = useState('');
  const [permissionUser, setPermissionUser] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [nextUsers, nextRoles, nextPermissions] = await Promise.all([
        listAccessUsers(),
        listAccessRoles(),
        listAccessPermissions(),
      ]);
      setUsers(nextUsers);
      setRoles(nextRoles);
      setPermissions(nextPermissions);
      setRoleId((current) => current || nextRoles.find((role) => role.name === 'Staf')?.id || '');
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function saveAction(action: () => Promise<unknown>, successMessage: string) {
    setSaving(true);
    setError('');
    try {
      await action();
      await load();
      setError(successMessage);
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveAction(
      () => addAccessUser({ username, displayName, pin, roleId }),
      'Akun baru berhasil dibuat.',
    );
    setUsername('');
    setDisplayName('');
    setPin('');
  }

  async function handleCreateRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveAction(
      () => addAccessRole({ name: newRoleName, permissions: newRolePermissions }),
      'Peran baru berhasil dibuat.',
    );
    setNewRoleName('');
    setNewRolePermissions([]);
  }

  async function changeRolePermission(role: AccessRole, permission: string, checked: boolean) {
    const next = checked
      ? [...new Set([...role.permissions, permission])]
      : role.permissions.filter((value) => value !== permission);
    await saveAction(
      () => editAccessRole(role.id, { permissions: next }),
      `Izin peran ${role.name} berhasil diperbarui.`,
    );
  }

  if (loading) return <p className="text-sm text-slate-500">Memuat pengaturan akses...</p>;

  const ownerRoleId = roles.find((role) => role.name === 'Pemilik')?.id;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Akses & Pengguna"
        description="Buat akun terpisah, gunakan peran sebagai preset, lalu sesuaikan izin tiap akun secara mandiri."
      />
      {error && (
        <p role="status" className={`rounded-md px-4 py-3 text-sm ${error.includes('berhasil') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {error}
        </p>
      )}

      <section className={`${cardClass} p-5`}>
        <h2 className="text-lg font-semibold text-slate-900">Tambah pengguna</h2>
        <p className="mt-1 text-sm text-slate-500">Setiap orang menggunakan username dan PIN sendiri. PIN di-hash sebelum disimpan.</p>
        <form onSubmit={(event) => void handleCreateUser(event)} className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="new-name" className={labelClass}>Nama tampilan</label>
            <input id="new-name" className={inputClass} value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={80} />
          </div>
          <div>
            <label htmlFor="new-username" className={labelClass}>Username unik</label>
            <input id="new-username" className={inputClass} value={username} onChange={(event) => setUsername(event.target.value)} required minLength={3} maxLength={30} autoComplete="off" />
          </div>
          <div>
            <label htmlFor="new-pin" className={labelClass}>PIN sementara (4–12 angka)</label>
            <input id="new-pin" className={inputClass} type="password" inputMode="numeric" pattern="[0-9]{4,12}" value={pin} onChange={(event) => setPin(event.target.value)} required minLength={4} maxLength={12} autoComplete="new-password" />
          </div>
          <div>
            <label htmlFor="new-role" className={labelClass}>Peran</label>
            <select id="new-role" className={inputClass} value={roleId} onChange={(event) => setRoleId(event.target.value)} required>
              <option value="" disabled>Pilih peran</option>
              {roles.filter((role) => role.id !== ownerRoleId).map((role) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <button className={btnPrimary} type="submit" disabled={saving || !roleId}>Buat akun</button>
          </div>
        </form>
      </section>

      <section className={`${cardClass} overflow-hidden`}>
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-lg font-semibold text-slate-900">Akun pengguna</h2>
          <p className="mt-1 text-sm text-slate-500">Nonaktifkan akun untuk mencabut seluruh sesi aktifnya.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="px-4 py-3">Pengguna</th><th className="px-4 py-3">Peran</th><th className="px-4 py-3">Status / PIN</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((managedUser) => {
                const isOwner = managedUser.role.name === 'Pemilik';
                return (
                  <tr key={managedUser.id}>
                    <td className="px-4 py-4">
                      <p className="font-medium text-slate-900">{managedUser.displayName}{managedUser.id === user?.id ? ' (kamu)' : ''}</p>
                      <p className="text-slate-500">@{managedUser.username}</p>
                      {!isOwner && (
                        <button type="button" className="mt-2 text-xs font-medium text-green-700 hover:underline"
                          onClick={() => setPermissionUser((current) => current === managedUser.id ? '' : managedUser.id)}>
                          {permissionUser === managedUser.id ? 'Tutup izin pengguna' : 'Atur izin pengguna'}
                        </button>
                      )}
                      {permissionUser === managedUser.id && !isOwner && (
                        <div className="mt-3 w-[min(32rem,70vw)] rounded-md border border-slate-200 p-3">
                          <p className="text-xs text-slate-600">
                            {managedUser.usesRolePermissions
                              ? 'Akun ini mengikuti izin preset perannya. Mengubah centang akan membuat izin khusus untuk akun ini.'
                              : 'Izin khusus hanya berlaku untuk akun ini.'}
                          </p>
                          {!managedUser.usesRolePermissions && (
                            <button type="button" className="mt-2 text-xs font-medium text-green-700 hover:underline"
                              disabled={saving}
                              onClick={() => void saveAction(
                                () => editAccessUser(managedUser.id, { permissions: null }),
                                `Izin ${managedUser.displayName} kembali mengikuti preset peran. Pengguna perlu login kembali.`,
                              )}>
                              Gunakan izin preset peran
                            </button>
                          )}
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {permissions.map((permission) => (
                              <label key={permission.key} className="flex items-start gap-2 rounded bg-slate-50 px-2 py-2 text-xs">
                                <input className="mt-0.5" type="checkbox"
                                  checked={managedUser.permissions.includes(permission.key)}
                                  disabled={saving || !managedUser.isActive}
                                  onChange={(event) => {
                                    const next = event.target.checked
                                      ? [...new Set([...managedUser.permissions, permission.key])]
                                      : managedUser.permissions.filter((value) => value !== permission.key);
                                    void saveAction(
                                      () => editAccessUser(managedUser.id, { permissions: next }),
                                      `Izin ${managedUser.displayName} diperbarui. Pengguna perlu login kembali.`,
                                    );
                                  }} />
                                <span>{permission.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {isOwner ? <span className="font-medium">{managedUser.role.name}</span> : (
                        <select className={inputClass} value={managedUser.role.id}
                          onChange={(event) => void saveAction(
                            () => editAccessUser(managedUser.id, { roleId: event.target.value }),
                            `Peran ${managedUser.displayName} diperbarui.`,
                          )}>
                          {roles.filter((role) => role.id !== ownerRoleId).map((role) => (
                            <option key={role.id} value={role.id}>{role.name}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="min-w-60 px-4 py-4">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={managedUser.isActive} disabled={isOwner || saving}
                          onChange={(event) => void saveAction(
                            () => editAccessUser(managedUser.id, { isActive: event.target.checked }),
                            `Status ${managedUser.displayName} diperbarui.`,
                          )} />
                        <span>{managedUser.isActive ? 'Aktif' : 'Dinonaktifkan'}</span>
                      </label>
                      {!isOwner && (
                        pinUser === managedUser.id ? (
                          <form className="mt-2 flex gap-2" onSubmit={(event) => {
                            event.preventDefault();
                            void saveAction(() => resetAccessPin(managedUser.id, newPin), 'PIN diperbarui dan sesi lama dicabut.');
                            setPinUser('');
                            setNewPin('');
                          }}>
                            <input aria-label={`PIN baru untuk ${managedUser.displayName}`} className={inputClass}
                              type="password" inputMode="numeric" pattern="[0-9]{4,12}" minLength={4} maxLength={12}
                              value={newPin} onChange={(event) => setNewPin(event.target.value)} required />
                            <button className={btnSecondary} type="submit" disabled={saving}>Simpan PIN</button>
                          </form>
                        ) : (
                          <button type="button" className="mt-2 text-xs font-medium text-green-700 hover:underline"
                            onClick={() => setPinUser(managedUser.id)}>Atur ulang PIN</button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`${cardClass} p-5`}>
        <h2 className="text-lg font-semibold text-slate-900">Peran dan izin fitur</h2>
        <p className="mt-1 text-sm text-slate-500">
          Atur preset peran di sini. Untuk mengubah akses satu orang saja, gunakan tombol Atur izin pengguna pada daftar akun.
        </p>
        <form onSubmit={(event) => void handleCreateRole(event)} className="mt-4 flex flex-wrap gap-3">
          <input className={`${inputClass} max-w-sm`} aria-label="Nama peran baru" placeholder="Contoh: Pengelola produk"
            value={newRoleName} onChange={(event) => setNewRoleName(event.target.value)} required minLength={2} maxLength={40} />
          <button className={btnSecondary} type="submit" disabled={saving}>Buat peran kosong</button>
        </form>
        <div className="mt-5 space-y-5">
          {roles.map((role) => (
            <div key={role.id} className="rounded-md border border-slate-200 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-900">{role.name}{role.isSystem ? ' · bawaan' : ''}</h3>
                  <p className="text-xs text-slate-500">{role.userCount} pengguna memakai peran ini</p>
                </div>
                {!role.isSystem && role.userCount === 0 && (
                  <button type="button" className={btnDanger} disabled={saving}
                    onClick={() => void saveAction(() => removeAccessRole(role.id), `Peran ${role.name} dihapus.`)}>
                    Hapus peran
                  </button>
                )}
              </div>
              {role.name === 'Pemilik' ? (
                <p className="text-sm text-slate-600">Peran Pemilik bawaan dilindungi dan selalu memiliki seluruh izin.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {permissions.map((permission) => (
                    <label key={permission.key} className="flex items-start gap-2 rounded bg-slate-50 px-3 py-2 text-sm">
                      <input className="mt-1" type="checkbox" checked={role.permissions.includes(permission.key)}
                        disabled={saving} onChange={(event) => void changeRolePermission(role, permission.key, event.target.checked)} />
                      <span>{permission.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
