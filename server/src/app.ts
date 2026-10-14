import express from 'express';
import { errorHandler } from './middleware/error-handler';
import { authenticateRequest, authorizeRequest } from './middleware/authenticate';
import { AppError } from './lib/errors';
import { redactPurchasePrice } from './lib/response';
import { authRouter } from './routes/auth.routes';
import { accessRouter } from './routes/access.routes';
import { apiRouter } from './routes';
import { getSessionToken } from './lib/auth';
import { idParamSchema } from './validators/common.validator';
import { quickSwitchUser, returnToOwner } from './services/auth.service';

export const app = express();

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api', authenticateRequest);

app.get('/api/auth/session', (req, res) => {
  res.json({ user: req.authUser });
});

app.use('/api', (req, _res, next) => {
  if (req.method !== 'GET' && req.get('x-app-request') !== '1') {
    next(new AppError(400, 'INVALID_REQUEST', 'Permintaan aplikasi tidak valid.'));
    return;
  }
  next();
});
app.use('/api', authorizeRequest);

app.post('/api/auth/quick-switch/return', async (req, res) => {
  res.json({ user: await returnToOwner(getSessionToken(req)) });
});

app.post('/api/auth/quick-switch/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json({ user: await quickSwitchUser(getSessionToken(req), id) });
});

app.use('/api/access', accessRouter);

app.use('/api', (req, res, next) => {
  if (req.authUser?.permissions.includes('product.cost.view')) {
    next();
    return;
  }

  const originalJson = res.json.bind(res);
  res.json = ((body?: unknown) => originalJson(redactPurchasePrice(body))) as typeof res.json;
  next();
});

app.use('/api', apiRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' } });
});

app.use(errorHandler);
