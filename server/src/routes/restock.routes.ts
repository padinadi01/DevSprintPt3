import { Router } from 'express';
import {
  listRestockOrders,
  getRestockOrder,
  createRestockOrder,
  cancelRestockOrder,
  createRestockReceipt,
} from '../services/restock.service';
import {
  createRestockOrderSchema,
  createRestockReceiptSchema,
} from '../validators/restock.validator';

export const restockRouter = Router();

restockRouter.get('/', async (_req, res) => {
  res.json(await listRestockOrders());
});

restockRouter.get('/:id', async (req, res) => {
  res.json(await getRestockOrder(req.params.id));
});

restockRouter.post('/', async (req, res) => {
  const input = createRestockOrderSchema.parse(req.body);
  res.status(201).json(await createRestockOrder(input));
});

restockRouter.patch('/:id/cancel', async (req, res) => {
  res.json(await cancelRestockOrder(req.params.id));
});

restockRouter.post('/:id/receipts', async (req, res) => {
  const input = createRestockReceiptSchema.parse(req.body);
  const receivedBy = req.authUser?.displayName;
  if (!receivedBy) throw new Error('Authenticated user missing after authorization.');
  res.status(201).json(await createRestockReceipt(req.params.id, receivedBy, input));
});
