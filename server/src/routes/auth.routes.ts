import { Router } from 'express';
import type { RequestHandler } from 'express';
import { AppError } from '../lib/errors';
import {
  clearSessionCookie,
  getSessionToken,
  makeSessionCookie,
} from '../lib/auth';
import { db } from '../lib/db';
import { login, revokeSession, setupOwner } from '../services/auth.service';
import { loginSchema, setupSchema } from '../validators/auth.validator';

interface LoginFailure {
  failures: number;
  resetAt: number;
}

const loginFailures = new Map<string, LoginFailure>();
const MAX_LOGIN_FAILURES = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function isLocked(key: string): boolean {
  const entry = loginFailures.get(key);
  if (!entry) return false;
  if (entry.resetAt <= Date.now()) {
    loginFailures.delete(key);
    return false;
  }
  return entry.failures >= MAX_LOGIN_FAILURES;
}

function recordFailure(key: string): void {
  const now = Date.now();
  const entry = loginFailures.get(key);
  if (!entry || entry.resetAt <= now) {
    loginFailures.set(key, { failures: 1, resetAt: now + LOCKOUT_MS });
  } else {
    entry.failures += 1;
  }
}

function clearFailures(key: string): void {
  loginFailures.delete(key);
}

export const authRouter = Router();

const requireAppHeader: RequestHandler = (req, _res, next) => {
  if (req.get('x-app-request') !== '1') {
    next(new AppError(400, 'INVALID_REQUEST', 'Permintaan aplikasi tidak valid.'));
    return;
  }
  next();
};

authRouter.use(requireAppHeader);

authRouter.get('/setup-status', async (_req, res) => {
  res.json({ setupRequired: (await db.user.count()) === 0 });
});

authRouter.post('/setup', async (req, res) => {
  const input = setupSchema.parse(req.body);
  const session = await setupOwner(input);
  res.setHeader('Set-Cookie', makeSessionCookie(session.token));
  res.status(201).json({ user: session.user, expiresAt: session.expiresAt });
});

authRouter.post('/login', async (req, res) => {
  const input = loginSchema.parse(req.body);
  const key = `${req.ip ?? 'unknown'}:${input.username}`;
  if (isLocked(key)) {
    throw new AppError(429, 'LOGIN_RATE_LIMITED', 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.');
  }

  const session = await login(input.username, input.pin);
  if (!session) {
    recordFailure(key);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Username atau PIN tidak benar.');
  }

  clearFailures(key);
  res.setHeader('Set-Cookie', makeSessionCookie(session.token));
  res.json({ user: session.user, expiresAt: session.expiresAt });
});

authRouter.post('/logout', async (req, res) => {
  await revokeSession(getSessionToken(req));
  res.setHeader('Set-Cookie', clearSessionCookie());
  res.status(204).send();
});
