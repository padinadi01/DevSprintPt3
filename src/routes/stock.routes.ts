import { Router } from 'express';
import { authenticate, requirePermissionOrRole, PERMISSIONS } from '../middleware/auth.middleware';
import { adjustStock, listStockMovements } from '../services/stock.service';
import {
  listStockMovementsQuerySchema,
  stockAdjustmentSchema,
} from '../validators/stock.validator';

export const stockRouter = Router();

// C4: Koreksi stok: Pemilik atau Staf dengan izin ADJUST_STOCK
stockRouter.post(
  '/stock-adjustments',
  authenticate,
  requirePermissionOrRole(PERMISSIONS.ADJUST_STOCK, 'PEMILIK'),
  async (req, res, next) => {
  try {
    const input = stockAdjustmentSchema.parse(req.body);
    // Identity binding: if not provided or to ensure audit, enforce person = user.name
    if (!input.person && req.user?.name) {
      input.person = req.user.name;
    }
    res.status(201).json(await adjustStock(input));
  } catch (error) {
    next(error);
  }
});

// C3: Lihat riwayat pergerakan stok: Staf & Pemilik
stockRouter.get('/stock-movements', authenticate, async (req, res, next) => {
  try {
    const filter = listStockMovementsQuerySchema.parse(req.query);
    res.json(await listStockMovements(filter));
  } catch (error) {
    next(error);
  }
});
