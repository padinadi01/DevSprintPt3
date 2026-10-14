import { Router } from 'express';
import { listSuppliers, createSupplier } from '../services/supplier.service';
import { createSupplierSchema } from '../validators/supplier.validator';

export const supplierRouter = Router();

supplierRouter.get('/', async (_req, res) => {
  res.json(await listSuppliers());
});

supplierRouter.post('/', async (req, res) => {
  const input = createSupplierSchema.parse(req.body);
  res.status(201).json(await createSupplier(input));
});
