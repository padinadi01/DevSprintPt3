import type { RequestHandler } from 'express';
import { UserRole } from '@prisma/client';
import { verifyAuthToken } from '../services/auth.service';
import { ForbiddenError, TooManyRequestsError, UnauthorizedError } from '../lib/errors';

// ---------------------------------------------------------------------------
// Rate Limiter for Login (C7)
// ---------------------------------------------------------------------------
interface AttemptRecord {
  count: number;
  firstAttemptAt: number;
}

const failedLoginAttempts = new Map<string, AttemptRecord>();
const MAX_FAILED_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 menit

export function checkLoginRateLimit(key: string): void {
  const now = Date.now();
  const record = failedLoginAttempts.get(key);

  if (record) {
    if (now - record.firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
      failedLoginAttempts.delete(key);
      return;
    }

    if (record.count >= MAX_FAILED_ATTEMPTS) {
      const remainingSeconds = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - record.firstAttemptAt)) / 1000);
      throw new TooManyRequestsError(
        `Terlalu banyak percobaan login gagal. Silakan coba lagi setelah ${remainingSeconds} detik.`
      );
    }
  }
}

export function recordFailedLogin(key: string): void {
  const now = Date.now();
  const record = failedLoginAttempts.get(key);

  if (!record || now - record.firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
    failedLoginAttempts.set(key, { count: 1, firstAttemptAt: now });
  } else {
    record.count += 1;
  }
}

export function clearFailedLogin(key: string): void {
  failedLoginAttempts.delete(key);
}

// ---------------------------------------------------------------------------
// Authentication Middleware (C3)
// ---------------------------------------------------------------------------
export const authenticate: RequestHandler = (req, _res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : (req.headers['x-auth-token'] as string | undefined);

  if (!token) {
    throw new UnauthorizedError('Autentikasi diperlukan. Silakan login terlebih dahulu.');
  }

  try {
    const user = verifyAuthToken(token);
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// Role & Permission Authorization Middleware (C4 + Custom Staff Access)
// Deny by default: if user's role/permission is not authorized, reject with 403
// ---------------------------------------------------------------------------
export const PERMISSIONS = {
  VIEW_DASHBOARD: 'VIEW_DASHBOARD',
  CREATE_PO: 'CREATE_PO',
  CANCEL_PO: 'CANCEL_PO',
  ADJUST_STOCK: 'ADJUST_STOCK',
  VIEW_COST: 'VIEW_COST',
  MANAGE_PRODUCTS: 'MANAGE_PRODUCTS',
  REVERSE_RECEIPT: 'REVERSE_RECEIPT',
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export const requireRole = (...allowedRoles: UserRole[]): RequestHandler => {
  return (req, _res, next) => {
    if (!req.user) {
      throw new UnauthorizedError('Autentikasi diperlukan. Silakan login terlebih dahulu.');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError(
        `Akses ditolak: peran ${req.user.role} tidak memiliki izin untuk aksi ini.`
      );
    }

    next();
  };
};

export const requirePermissionOrRole = (
  permission: string,
  ...allowedRoles: UserRole[]
): RequestHandler => {
  return (req, _res, next) => {
    if (!req.user) {
      throw new UnauthorizedError('Autentikasi diperlukan. Silakan login terlebih dahulu.');
    }

    // Pemilik always has full access
    if (req.user.role === UserRole.PEMILIK) {
      return next();
    }

    // Role check
    if (allowedRoles.includes(req.user.role)) {
      return next();
    }

    // Specific permission granted to staff
    if (req.user.permissions && req.user.permissions.includes(permission)) {
      return next();
    }

    throw new ForbiddenError(
      `Akses ditolak: akun ${req.user.name} (${req.user.role}) tidak memiliki izin "${permission}".`
    );
  };
};

// ---------------------------------------------------------------------------
// Response Cost Masking Helpers (C6 + VIEW_COST permission)
// ---------------------------------------------------------------------------
export function maskProductCost<T extends Record<string, any>>(
  product: T,
  roleOrUser?: UserRole | { role: UserRole; permissions?: string[] }
): T {
  const role = typeof roleOrUser === 'string' ? roleOrUser : roleOrUser?.role;
  const permissions = typeof roleOrUser === 'object' ? roleOrUser?.permissions : undefined;
  const canSeeCost = role === UserRole.PEMILIK || (permissions && permissions.includes(PERMISSIONS.VIEW_COST));

  if (!canSeeCost) {
    const { purchasePrice, ...rest } = product;
    return rest as T;
  }
  return product;
}

export function maskGoodsReceiptCost<T extends Record<string, any>>(
  receipt: T,
  roleOrUser?: UserRole | { role: UserRole; permissions?: string[] }
): T {
  const role = typeof roleOrUser === 'string' ? roleOrUser : roleOrUser?.role;
  const permissions = typeof roleOrUser === 'object' ? roleOrUser?.permissions : undefined;
  const canSeeCost = role === UserRole.PEMILIK || (permissions && permissions.includes(PERMISSIONS.VIEW_COST));

  if (!canSeeCost) {
    const masked: any = { ...receipt };
    if (Array.isArray(masked.items)) {
      masked.items = masked.items.map((item: any) => {
        const { unitCostPerPurchaseUnit, unitCostPerBaseUnit, ...rest } = item;
        return rest;
      });
    }
    return masked as T;
  }
  return receipt;
}

export function maskPurchaseOrderCost<T extends Record<string, any>>(
  po: T,
  roleOrUser?: UserRole | { role: UserRole; permissions?: string[] }
): T {
  const role = typeof roleOrUser === 'string' ? roleOrUser : roleOrUser?.role;
  const permissions = typeof roleOrUser === 'object' ? roleOrUser?.permissions : undefined;
  const canSeeCost = role === UserRole.PEMILIK || (permissions && permissions.includes(PERMISSIONS.VIEW_COST));

  if (!canSeeCost) {
    const masked: any = { ...po };
    if (Array.isArray(masked.receipts)) {
      masked.receipts = masked.receipts.map((r: any) => maskGoodsReceiptCost(r, roleOrUser));
    }
    return masked as T;
  }
  return po;
}
