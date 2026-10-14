import { Router } from 'express';
import {
  listInventoryChecks,
  getInventoryCheck,
  createInventoryCheck,
} from '../services/inventory.service';
import { createInventoryCheckSchema } from '../validators/inventory.validator';

export const inventoryRouter = Router();

inventoryRouter.get('/', async (_req, res) => {
  res.json(await listInventoryChecks());
});

inventoryRouter.get('/:id', async (req, res) => {
  res.json(await getInventoryCheck(req.params.id));
});

inventoryRouter.post('/', async (req, res) => {
  const input = createInventoryCheckSchema.parse(req.body);
  const checkedBy = req.authUser?.displayName;
  if (!checkedBy) throw new Error('Authenticated user missing after authorization.');
  res.status(201).json(await createInventoryCheck(input, checkedBy));
});
