import { Router } from 'express';
import { adjustStock, listStockMovements } from '../services/stock.service';
import {
  listStockMovementsQuerySchema,
  stockAdjustmentSchema,
} from '../validators/stock.validator';

export const stockRouter = Router();

stockRouter.post('/stock-adjustments', async (req, res) => {
  const input = stockAdjustmentSchema.parse(req.body);
  res.status(201).json(await adjustStock(input));
});

stockRouter.get('/stock-movements', async (req, res) => {
  const filter = listStockMovementsQuerySchema.parse(req.query);
  res.json(await listStockMovements(filter));
});
