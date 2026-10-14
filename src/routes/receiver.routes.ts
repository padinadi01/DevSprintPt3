import { Router, type RequestHandler } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { db } from '../lib/db';

export const receiverRouter = Router();

const list: RequestHandler = async (_req, res, next) => {
  try {
    const receivers = await db.receiver.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(receivers);
  } catch (error) {
    next(error);
  }
};

receiverRouter.get('/', authenticate, list);
