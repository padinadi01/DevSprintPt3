import type { RequestHandler } from 'express';
import { db } from '../lib/db';
import {
  getSessionToken,
  hashSessionToken,
  toAuthenticatedUser,
} from '../lib/auth';
import { AppError } from '../lib/errors';
import { canReadSales, getRequiredPermissions, hasPermissions } from '../lib/permissions';

export const authenticateRequest: RequestHandler = async (req, _res, next) => {
  const token = getSessionToken(req);
  if (!token) {
    next(new AppError(401, 'UNAUTHENTICATED', 'Silakan login untuk melanjutkan.'));
    return;
  }

  const session = await db.authSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: {
      user: { include: { role: true } },
      actingAsUser: { include: { role: true } },
    },
  });
  if (
    !session ||
    session.expiresAt <= new Date() ||
    !session.user.isActive
  ) {
    if (session) await db.authSession.delete({ where: { id: session.id } });
    next(new AppError(401, 'UNAUTHENTICATED', 'Sesi tidak berlaku. Silakan login kembali.'));
    return;
  }

  if (session.actingAsUserId && session.user.roleId !== 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') {
    await db.authSession.delete({ where: { id: session.id } });
    next(new AppError(401, 'UNAUTHENTICATED', 'Sesi beralih akun tidak berlaku. Silakan login kembali.'));
    return;
  }

  let effectiveUser = session.actingAsUser ?? session.user;
  let isImpersonating = Boolean(session.actingAsUserId);
  if (isImpersonating && !effectiveUser.isActive) {
    await db.$transaction([
      db.authSwitchAudit.create({
        data: {
          ownerUserId: session.userId,
          targetUserId: effectiveUser.id,
          action: 'FORCED_RETURN',
        },
      }),
      db.authSession.update({
        where: { id: session.id },
        data: { actingAsUserId: null },
      }),
    ]);
    effectiveUser = session.user;
    isImpersonating = false;
  }

  req.authUser = toAuthenticatedUser(effectiveUser, isImpersonating);
  next();
};

export const authorizeRequest: RequestHandler = (req, _res, next) => {
  const user = req.authUser;
  if (!user) {
    next(new AppError(401, 'UNAUTHENTICATED', 'Silakan login untuk melanjutkan.'));
    return;
  }

  const permissions = getRequiredPermissions(req);
  if (permissions === undefined) {
    next();
    return;
  }

  const adminPermission =
    req.originalUrl.startsWith('/api/access/users') ? 'users.manage' : 'roles.manage';
  const required = req.originalUrl.startsWith('/api/access/')
    ? [adminPermission]
    : permissions;
  const salesRead =
    req.method === 'GET' &&
    /^\/api\/sales(?:\/[^/?]+)?(?:\?|$)/.test(req.originalUrl);
  const allowed = salesRead
    ? canReadSales(user.permissions)
    : hasPermissions(user.permissions, required);
  if (!allowed) {
    next(new AppError(403, 'FORBIDDEN', 'Peran Anda tidak memiliki izin untuk tindakan ini.'));
    return;
  }
  next();
};
