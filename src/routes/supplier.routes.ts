import { Router, type RequestHandler } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { db } from '../lib/db';

export const supplierRouter = Router();

const list: RequestHandler = async (_req, res, next) => {
  try {
    const data = await db.supplier.findMany({ orderBy: { name: 'asc' } });
    res.json(data);
  } catch (error) {
    next(error);
  }
};

supplierRouter.get('/', authenticate, list);
