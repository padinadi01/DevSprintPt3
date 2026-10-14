import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { createSale, getSale, listSales } from '../services/sale.service';
import { idParamSchema } from '../validators/common.validator';
import { createSaleSchema } from '../validators/sale.validator';

export const saleRouter = Router();

saleRouter.get('/', authenticate, async (_req, res, next) => {
  try {
    res.json(await listSales());
  } catch (error) {
    next(error);
  }
});

saleRouter.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    res.json(await getSale(id));
  } catch (error) {
    next(error);
  }
});

saleRouter.post('/', authenticate, async (req, res, next) => {
  try {
    const input = createSaleSchema.parse(req.body);
    res.status(201).json(await createSale(input));
  } catch (error) {
    next(error);
  }
});
