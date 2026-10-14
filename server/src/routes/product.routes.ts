import { Router } from 'express';
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  setProductStatus,
  updateProduct,
} from '../services/product.service';
import { idParamSchema } from '../validators/common.validator';
import {
  createProductSchema,
  listProductsQuerySchema,
  updateProductSchema,
  updateProductStatusSchema,
} from '../validators/product.validator';

// Route handlers stay thin: validate input with Zod, call a service, send the result.
export const productRouter = Router();

productRouter.get('/', async (req, res) => {
  const filter = listProductsQuerySchema.parse(req.query);
  res.json(await listProducts(filter));
});

productRouter.get('/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await getProduct(id));
});

productRouter.post('/', async (req, res) => {
  const input = createProductSchema.parse(req.body);
  res.status(201).json(await createProduct(input));
});

productRouter.patch('/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const input = updateProductSchema.parse(req.body);
  res.json(await updateProduct(id, input));
});

productRouter.patch('/:id/status', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const input = updateProductStatusSchema.parse(req.body);
  res.json(await setProductStatus(id, input));
});

productRouter.delete('/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  await deleteProduct(id);
  res.status(204).send();
});
