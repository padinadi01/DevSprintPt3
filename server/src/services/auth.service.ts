import { Prisma, type AccessRole } from '@prisma/client';
import { db } from '../lib/db';
import {
  hashPin,
  hashSessionToken,
  makeSessionToken,
  SESSION_TTL_MS,
  toAuthenticatedUser,
  verifyPin,
} from '../lib/auth';
import { AppError, ConflictError, NotFoundError } from '../lib/errors';
import { permissionCatalog } from '../lib/permissions';
import type {
  createRoleSchema,
  createUserSchema,
  setupSchema,
  updatePinSchema,
  updateRoleSchema,
  updateUserSchema,
} from '../validators/auth.validator';
import type { z } from 'zod';

const OWNER_ROLE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PERMISSION_KEYS: ReadonlySet<string> = new Set(permissionCatalog.map((permission) => permission.key));
const PRIVILEGED_PERMISSIONS: ReadonlySet<string> = new Set([
  'users.manage',
  'roles.manage',
  'product.cost.view',
  'restock.create',
]);

export interface CreatedSession {
  token: string;
  expiresAt: Date;
  user: ReturnType<typeof toAuthenticatedUser>;
}

function publicUser(user: {
  id: string;
  username: string;
  displayName: string;
  isActive: boolean;
  createdAt: Date;
  permissions: string[];
  usesRolePermissions: boolean;
  role: Pick<AccessRole, 'id' | 'name' | 'permissions' | 'isSystem'>;
}) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    isActive: user.isActive,
    isImpersonating: false as const,
    createdAt: user.createdAt,
    permissions: user.usesRolePermissions ? user.role.permissions : user.permissions,
    usesRolePermissions: user.usesRolePermissions,
    role: user.role,
  };
}

function assertRolePermissions(permissions: string[]): string[] {
  const unique = [...new Set(permissions)];
  const invalid = unique.filter((permission) => !PERMISSION_KEYS.has(permission));
  if (invalid.length) {
    throw new AppError(400, 'INVALID_PERMISSIONS', 'Daftar izin berisi izin yang tidak dikenal.');
  }
  if (unique.some((permission) => PRIVILEGED_PERMISSIONS.has(permission))) {
    throw new AppError(400, 'INVALID_PERMISSIONS', 'Hak mengelola akun/peran, melihat harga modal, dan membuat pesanan berharga modal hanya tersedia untuk Pemilik.');
  }
  const dependencies: Record<string, string[]> = {
    'products.manage': ['products.view'],
    'sales.create': ['products.view'],
    'suppliers.manage': ['suppliers.view'],
    'restock.receive': ['restock.view'],
    'restock.cancel': ['restock.view'],
    'inventory.create': ['inventory.view', 'products.view'],
    'stock.adjust': ['stock.view', 'products.view'],
  };
  const expanded = new Set(unique);
  for (const permission of unique) {
    for (const dependency of dependencies[permission] ?? []) expanded.add(dependency);
  }
  return [...expanded];
}

function isSerializationConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

export async function setupOwner(input: z.infer<typeof setupSchema>): Promise<CreatedSession> {
  const pinHash = await hashPin(input.pin);
  const token = makeSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  try {
    return await db.$transaction(async (tx) => {
      const count = await tx.user.count();
      if (count > 0) throw new ConflictError('Akun sudah dibuat. Silakan login.');

      const role = await tx.accessRole.findUnique({ where: { id: OWNER_ROLE_ID } });
      if (!role) throw new Error('Role Pemilik belum tersedia. Jalankan migrasi database terlebih dahulu.');

      const user = await tx.user.create({
        data: {
          username: input.username,
          displayName: input.displayName,
          pinHash,
          roleId: role.id,
        },
        include: { role: true },
      });
      await tx.authSession.create({
        data: { tokenHash: hashSessionToken(token), userId: user.id, expiresAt },
      });
      return { token, expiresAt, user: toAuthenticatedUser(user) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (isSerializationConflict(error)) {
      throw new ConflictError('Akun sudah dibuat. Silakan login.');
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError('Username sudah digunakan.');
    }
    throw error;
  }
}

export async function login(
  username: string,
  pin: string,
): Promise<CreatedSession | undefined> {
  const user = await db.user.findUnique({
    where: { username },
    include: { role: true },
  });
  if (!user || !user.isActive || !(await verifyPin(pin, user.pinHash))) return undefined;

  const token = makeSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.authSession.create({
    data: { tokenHash: hashSessionToken(token), userId: user.id, expiresAt },
  });
  return { token, expiresAt, user: toAuthenticatedUser(user) };
}

export async function revokeSession(token: string | undefined): Promise<void> {
  if (!token) return;
  const session = await db.authSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: { id: true, userId: true, actingAsUserId: true },
  });
  if (!session) return;
  await db.$transaction(async (tx) => {
    if (session.actingAsUserId) {
      await tx.authSwitchAudit.create({
        data: {
          ownerUserId: session.userId,
          targetUserId: session.actingAsUserId,
          action: 'LOGOUT',
        },
      });
    }
    await tx.authSession.deleteMany({ where: { id: session.id } });
  });
}

export async function quickSwitchUser(token: string | undefined, targetUserId: string) {
  if (!token) throw new AppError(401, 'UNAUTHENTICATED', 'Silakan login untuk melanjutkan.');
  const session = await db.authSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: { include: { role: true } }, actingAsUser: { include: { role: true } } },
  });
  if (!session || session.expiresAt <= new Date() || !session.user.isActive) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Sesi Pemilik tidak berlaku. Silakan login kembali.');
  }
  if (session.user.roleId !== OWNER_ROLE_ID || session.actingAsUserId) {
    throw new AppError(403, 'FORBIDDEN', 'Quick switch hanya dapat dimulai dari sesi Pemilik.');
  }

  const target = await db.user.findUnique({
    where: { id: targetUserId },
    include: { role: true },
  });
  if (!target || !target.isActive) throw new NotFoundError('Pengguna aktif tidak ditemukan.');
  if (target.roleId === OWNER_ROLE_ID) {
    throw new AppError(400, 'INVALID_TARGET', 'Pilih akun non-Pemilik untuk quick switch.');
  }

  const [, updatedSession] = await db.$transaction([
    db.authSwitchAudit.create({
      data: { ownerUserId: session.userId, targetUserId: target.id, action: 'START' },
    }),
    db.authSession.update({
      where: { id: session.id },
      data: { actingAsUserId: target.id },
      include: { user: { include: { role: true } }, actingAsUser: { include: { role: true } } },
    }),
  ]);
  if (!updatedSession.actingAsUser) throw new Error('Quick switch target missing after update.');
  return toAuthenticatedUser(updatedSession.actingAsUser, true);
}

export async function returnToOwner(token: string | undefined) {
  if (!token) throw new AppError(401, 'UNAUTHENTICATED', 'Silakan login untuk melanjutkan.');
  const session = await db.authSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: { include: { role: true } }, actingAsUser: { include: { role: true } } },
  });
  if (!session || session.expiresAt <= new Date() || !session.user.isActive) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Sesi Pemilik tidak berlaku. Silakan login kembali.');
  }
  if (session.user.roleId !== OWNER_ROLE_ID || !session.actingAsUser || !session.actingAsUserId) {
    throw new AppError(403, 'FORBIDDEN', 'Tidak ada sesi impersonasi untuk dikembalikan.');
  }

  await db.$transaction([
    db.authSwitchAudit.create({
      data: {
        ownerUserId: session.userId,
        targetUserId: session.actingAsUserId,
        action: 'RETURN',
      },
    }),
    db.authSession.update({
      where: { id: session.id },
      data: { actingAsUserId: null },
    }),
  ]);
  return toAuthenticatedUser(session.user);
}

export async function listUsers() {
  const users = await db.user.findMany({
    include: { role: true },
    orderBy: [{ isActive: 'desc' }, { displayName: 'asc' }],
  });
  return users.map(publicUser);
}

export async function listRoles() {
  const roles = await db.accessRole.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
  });
  return roles.map((role) => ({
    id: role.id,
    name: role.name,
    permissions: role.permissions,
    isSystem: role.isSystem,
    userCount: role._count.users,
  }));
}

export async function createUser(input: z.infer<typeof createUserSchema>) {
  const role = await db.accessRole.findUnique({ where: { id: input.roleId } });
  if (!role) throw new NotFoundError('Peran tidak ditemukan.');
  if (role.id === OWNER_ROLE_ID) {
    throw new AppError(403, 'FORBIDDEN', 'Akun Pemilik hanya dapat dibuat melalui setup awal.');
  }
  const user = await db.user.create({
    data: {
      username: input.username,
      displayName: input.displayName,
      pinHash: await hashPin(input.pin),
      roleId: role.id,
    },
    include: { role: true },
  });
  return publicUser(user);
}

export async function updateUser(
  id: string,
  input: z.infer<typeof updateUserSchema>,
  actorId: string,
) {
  const current = await db.user.findUnique({ where: { id }, include: { role: true } });
  if (!current) throw new NotFoundError('Pengguna tidak ditemukan.');
  if (current.roleId === OWNER_ROLE_ID) {
    throw new AppError(403, 'FORBIDDEN', 'Akun Pemilik utama tidak dapat diubah dari modul ini.');
  }
  if (input.roleId) {
    const role = await db.accessRole.findUnique({ where: { id: input.roleId } });
    if (!role) throw new NotFoundError('Peran tidak ditemukan.');
    if (role.id === OWNER_ROLE_ID) {
      throw new AppError(403, 'FORBIDDEN', 'Peran Pemilik tidak dapat diberikan kepada akun lain.');
    }
  }
  if (id === actorId && input.isActive === false) {
    throw new AppError(409, 'CONFLICT', 'Akun yang sedang dipakai tidak dapat dinonaktifkan.');
  }
  const { permissions: requestedPermissions, ...profileInput } = input;
  const updateData: Prisma.UserUpdateInput = { ...profileInput };
  if (requestedPermissions === null) {
    updateData.permissions = [];
    updateData.usesRolePermissions = true;
  } else if (requestedPermissions !== undefined) {
    updateData.permissions = assertRolePermissions(requestedPermissions);
    updateData.usesRolePermissions = false;
  } else if (input.roleId) {
    updateData.permissions = [];
    updateData.usesRolePermissions = true;
  }
  const updated = await db.$transaction(async (tx) => {
    const changed = await tx.user.update({
      where: { id },
      data: updateData,
      include: { role: true },
    });
    if (input.isActive === false || input.roleId || requestedPermissions !== undefined) {
      await tx.authSession.deleteMany({ where: { userId: id } });
    }
    return changed;
  });
  return publicUser(updated);
}

export async function resetUserPin(id: string, input: z.infer<typeof updatePinSchema>) {
  const user = await db.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError('Pengguna tidak ditemukan.');
  if (user.roleId === OWNER_ROLE_ID) {
    throw new AppError(403, 'FORBIDDEN', 'PIN Pemilik tidak dapat diubah dari modul ini.');
  }
  await db.$transaction([
    db.user.update({ where: { id }, data: { pinHash: await hashPin(input.pin) } }),
    db.authSession.deleteMany({ where: { userId: id } }),
  ]);
}

export async function createRole(input: z.infer<typeof createRoleSchema>) {
  const role = await db.accessRole.create({
    data: {
      name: input.name,
      permissions: assertRolePermissions(input.permissions),
    },
    include: { _count: { select: { users: true } } },
  });
  return { id: role.id, name: role.name, permissions: role.permissions, isSystem: role.isSystem, userCount: role._count.users };
}

export async function updateRole(id: string, input: z.infer<typeof updateRoleSchema>) {
  const role = await db.accessRole.findUnique({ where: { id } });
  if (!role) throw new NotFoundError('Peran tidak ditemukan.');
  if (role.id === OWNER_ROLE_ID) {
    throw new AppError(403, 'FORBIDDEN', 'Izin Pemilik dilindungi dan tidak dapat diubah.');
  }
  const updated = await db.accessRole.update({
    where: { id },
    data: {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.permissions === undefined ? {} : { permissions: assertRolePermissions(input.permissions) }),
    },
    include: { _count: { select: { users: true } } },
  });
  return { id: updated.id, name: updated.name, permissions: updated.permissions, isSystem: updated.isSystem, userCount: updated._count.users };
}

export async function deleteRole(id: string): Promise<void> {
  const role = await db.accessRole.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
  if (!role) throw new NotFoundError('Peran tidak ditemukan.');
  if (role.isSystem) throw new AppError(403, 'FORBIDDEN', 'Peran bawaan tidak dapat dihapus.');
  if (role._count.users > 0) throw new ConflictError('Pindahkan pengguna dari peran ini sebelum menghapusnya.');
  await db.accessRole.delete({ where: { id } });
}

export function getPermissionCatalog() {
  return permissionCatalog
    .filter((permission) => !PRIVILEGED_PERMISSIONS.has(permission.key))
    .map((permission) => ({ ...permission }));
}
