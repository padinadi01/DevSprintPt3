import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../lib/db';
import { cache } from '../lib/cache';
import { UnauthorizedError, NotFoundError, BadRequestError } from '../lib/errors';
import { UserRole } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'warung-madura-secret-key-24jam';
const JWT_EXPIRES_IN = '24h';

const revokedUserIds = new Set<string>();

export function revokeUser(userId: string): void {
  revokedUserIds.add(userId);
  cache.set(`user:revoked:${userId}`, true, 86400000);
  cache.delete(`user:exists:${userId}`);
}

export function isUserRevoked(userId: string): boolean {
  if (revokedUserIds.has(userId)) return true;
  if (cache.get<boolean>(`user:revoked:${userId}`)) return true;
  return false;
}

export interface AuthUserPayload {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  permissions: string[];
  receiverId: string | null;
}

export interface LoginResult {
  token: string;
  user: AuthUserPayload;
}

export async function loginWithPin(usernameOrName: string, pin: string): Promise<LoginResult> {
  const normalized = usernameOrName.trim().toLowerCase();
  
  // 1. Fast indexed lookup by unique username first (O(1))
  let user = await db.user.findFirst({
    where: { username: normalized },
  });

  // 2. Fallback to name or case-insensitive if not found by exact username
  if (!user) {
    user = await db.user.findFirst({
      where: {
        OR: [
          { username: { equals: normalized, mode: 'insensitive' } },
          { name: { equals: normalized, mode: 'insensitive' } },
        ],
      },
    });
  }

  if (!user) {
    // C2: Pesan umum agar tidak membocorkan keberadaan username
    throw new UnauthorizedError('Nama pengguna atau PIN salah.');
  }

  const isValidPin = await bcrypt.compare(pin, user.pinHash);
  if (!isValidPin) {
    // C2: Pesan umum
    throw new UnauthorizedError('Nama pengguna atau PIN salah.');
  }

  const payload: AuthUserPayload = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    permissions: user.permissions || [],
    receiverId: user.receiverId,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  return { token, user: payload };
}

export function verifyAuthToken(token: string): AuthUserPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUserPayload;
    if (isUserRevoked(decoded.id)) {
      throw new UnauthorizedError('Akun pengguna telah dinonaktifkan atau dihapus.');
    }
    return decoded;
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError('Token autentikasi tidak valid atau sudah kedaluwarsa.');
  }
}

export async function listAllUsers() {
  const cached = cache.get<any[]>('users:all');
  if (cached) return cached;

  const users = await db.user.findMany({
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      permissions: true,
      receiverId: true,
      createdAt: true,
      receiver: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { role: 'asc' },
  });

  cache.set('users:all', users, 30000);
  return users;
}

export async function updateUserRole(userId: string, role: UserRole) {
  const updated = await db.user.update({
    where: { id: userId },
    data: { role },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      permissions: true,
      receiverId: true,
    },
  });
  cache.invalidate('users');
  return updated;
}

export async function updateUserPermissions(userId: string, permissions: string[]) {
  const updated = await db.user.update({
    where: { id: userId },
    data: { permissions },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      permissions: true,
      receiverId: true,
    },
  });
  cache.invalidate('users');
  return updated;
}

export async function updateUserPin(userId: string, pin: string) {
  const pinHash = await bcrypt.hash(pin, 10);
  const updated = await db.user.update({
    where: { id: userId },
    data: { pinHash },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      permissions: true,
      receiverId: true,
    },
  });
  cache.invalidate('users');
  return updated;
}

export async function createUser(data: {
  username: string;
  name: string;
  pin: string;
  role: UserRole;
  permissions?: string[];
  receiverId?: string | null;
}) {
  const pinHash = await bcrypt.hash(data.pin, 10);
  const created = await db.user.create({
    data: {
      username: data.username.toLowerCase(),
      name: data.name,
      pinHash,
      role: data.role,
      permissions: data.permissions || [],
      receiverId: data.receiverId || null,
    },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      permissions: true,
      receiverId: true,
      createdAt: true,
    },
  });
  cache.invalidate('users');
  return created;
}

export async function switchUser(username: string): Promise<LoginResult> {
  const normalized = username.trim().toLowerCase();
  let user = await db.user.findFirst({
    where: { username: normalized },
  });

  if (!user) {
    user = await db.user.findFirst({
      where: {
        username: { equals: normalized, mode: 'insensitive' },
      },
    });
  }

  if (!user) {
    throw new UnauthorizedError('Pengguna tidak ditemukan.');
  }

  const payload: AuthUserPayload = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    permissions: user.permissions || [],
    receiverId: user.receiverId,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  return { token, user: payload };
}

export async function deleteUser(targetUserId: string, currentUserId: string) {
  // 1. Owner can't delete themselves
  if (targetUserId === currentUserId) {
    throw new BadRequestError('Anda tidak dapat menghapus akun Anda sendiri.');
  }

  // 2. Find target user
  let targetUser: any = null;
  try {
    targetUser = await db.user.findUnique({
      where: { id: targetUserId },
    });
  } catch {
    targetUser = null;
  }

  if (!targetUser) {
    throw new NotFoundError('Pengguna tidak ditemukan.');
  }

  // Double check username to prevent deleting self via alternative representation
  let currentUser: any = null;
  try {
    currentUser = await db.user.findUnique({
      where: { id: currentUserId },
    });
  } catch {
    currentUser = null;
  }

  if (currentUser && currentUser.username.toLowerCase() === targetUser.username.toLowerCase()) {
    throw new BadRequestError('Anda tidak dapat menghapus akun Anda sendiri.');
  }

  // 3. If target user is PEMILIK, ensure not the last remaining PEMILIK
  if (targetUser.role === UserRole.PEMILIK) {
    const ownerCount = await db.user.count({
      where: { role: UserRole.PEMILIK },
    });
    if (ownerCount <= 1) {
      throw new BadRequestError('Tidak dapat menghapus pemilik terakhir. Sistem harus memiliki minimal satu akun PEMILIK.');
    }
  }

  // 4. Delete user record (Receiver and other models remain intact)
  const deleted = await db.user.delete({
    where: { id: targetUserId },
  });

  // 5. Instantly revoke any existing tokens for this user and invalidate cache
  revokeUser(targetUserId);
  cache.invalidate('users');

  return {
    id: deleted.id,
    username: deleted.username,
    name: deleted.name,
    message: `Pengguna ${deleted.name} (@${deleted.username}) berhasil dihapus.`,
  };
}
