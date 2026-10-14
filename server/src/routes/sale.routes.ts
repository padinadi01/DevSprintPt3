import { Router } from 'express';
import { createSale, getSale, listSales } from '../services/sale.service';
import { idParamSchema } from '../validators/common.validator';
import { createSaleSchema } from '../validators/sale.validator';

export const saleRouter = Router();

saleRouter.get('/', async (req, res) => {
  const user = req.authUser;
  if (!user) throw new Error('Authenticated user missing after authorization.');
  const mayViewAll = user.permissions.includes('sales.view.all');
  res.json(await listSales(mayViewAll ? undefined : user.id));
});

saleRouter.get('/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const user = req.authUser;
  if (!user) throw new Error('Authenticated user missing after authorization.');
  const mayViewAll = user.permissions.includes('sales.view.all');
  res.json(await getSale(id, mayViewAll ? undefined : user.id));
});

saleRouter.post('/', async (req, res) => {
  const input = createSaleSchema.parse(req.body);
  const user = req.authUser;
  if (!user) throw new Error('Authenticated user missing after authorization.');
  res.status(201).json(await createSale(input, user.id));
});
