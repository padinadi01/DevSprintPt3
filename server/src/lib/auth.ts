import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Request } from 'express';
import type { AccessRole, User } from '@prisma/client';
import { resolveUserPermissions } from './permissions';

const scrypt = promisify(scryptCallback);

export const SESSION_COOKIE = 'warung_session';
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export interface AuthenticatedUser {
  id: string;
  username: string;
  displayName: string;
  isActive: boolean;
  permissions: string[];
  isImpersonating: boolean;
  role: Pick<AccessRole, 'id' | 'name' | 'permissions' | 'isSystem'>;
}

export interface SessionUser extends User {
  role: AccessRole;
}

declare module 'express-serve-static-core' {
  interface Request {
    authUser?: AuthenticatedUser;
  }
}

export function toAuthenticatedUser(user: SessionUser, isImpersonating = false): AuthenticatedUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    isActive: user.isActive,
    permissions: resolveUserPermissions(
      user.usesRolePermissions,
      user.permissions,
      user.role.permissions,
    ),
    isImpersonating,
    role: {
      id: user.role.id,
      name: user.role.name,
      permissions: user.role.permissions,
      isSystem: user.role.isSystem,
    },
  };
}

export function getSessionToken(req: Request): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;

  for (const item of cookieHeader.split(';')) {
    const [name, ...value] = item.trim().split('=');
    if (name === SESSION_COOKIE) {
      const token = value.join('=');
      return /^[A-Za-z0-9_-]{40,60}$/.test(token) ? token : undefined;
    }
  }
  return undefined;
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function makeSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function makeSessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/api; SameSite=Strict; Max-Age=${SESSION_TTL_MS / 1000}${secure}`;
}

export function clearSessionCookie(): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=; HttpOnly; Path=/api; SameSite=Strict; Max-Age=0${secure}`;
}

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(pin, salt, 64)) as Buffer;
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export async function verifyPin(pin: string, encoded: string): Promise<boolean> {
  const [algorithm, saltHex, expectedHex] = encoded.split('$');
  if (
    algorithm !== 'scrypt' ||
    !saltHex ||
    !expectedHex ||
    !/^[a-f0-9]{32}$/.test(saltHex) ||
    !/^[a-f0-9]{128}$/.test(expectedHex)
  ) {
    return false;
  }

  const actual = (await scrypt(pin, Buffer.from(saltHex, 'hex'), 64)) as Buffer;
  const expected = Buffer.from(expectedHex, 'hex');
  return timingSafeEqual(actual, expected);
}

export function requireAppRequestHeader(req: Request): boolean {
  return req.get('x-app-request') === '1';
}
