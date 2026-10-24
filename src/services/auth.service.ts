import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../lib/db';
import { cache } from '../lib/cache';
import { UnauthorizedError } from '../lib/errors';
import type { UserRole } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'warung-madura-secret-key-24jam';
const JWT_EXPIRES_IN = '24h';

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
    return decoded;
  } catch {
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
