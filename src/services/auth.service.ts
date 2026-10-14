import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../lib/db';
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
  
  // Find user by username or name (case-insensitive)
  const user = await db.user.findFirst({
    where: {
      OR: [
        { username: { equals: normalized, mode: 'insensitive' } },
        { name: { equals: normalized, mode: 'insensitive' } },
      ],
    },
  });

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
  return db.user.findMany({
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
}

export async function updateUserRole(userId: string, role: UserRole) {
  return db.user.update({
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
}

export async function updateUserPermissions(userId: string, permissions: string[]) {
  return db.user.update({
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
}

export async function updateUserPin(userId: string, pin: string) {
  const pinHash = await bcrypt.hash(pin, 10);
  return db.user.update({
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
  return db.user.create({
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
}

export async function switchUser(username: string): Promise<LoginResult> {
  const normalized = username.trim().toLowerCase();
  const user = await db.user.findFirst({
    where: {
      username: { equals: normalized, mode: 'insensitive' },
    },
  });

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

