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

import { authenticate, requirePermissionOrRole, PERMISSIONS, maskProductCost } from '../middleware/auth.middleware';

// Route handlers stay thin: validate input with Zod, call a service, send the result.
export const productRouter = Router();

// C3 & C6: Lihat katalog produk (Staf dan Pemilik). Harga modal disembunyikan untuk Staf
productRouter.get('/', authenticate, async (req, res, next) => {
  try {
    const filter = listProductsQuerySchema.parse(req.query);
    const products = await listProducts(filter);
    const masked = products.map((p) => maskProductCost(p, req.user));
    res.json(masked);
  } catch (error) {
    next(error);
  }
});

productRouter.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const product = await getProduct(id);
    res.json(maskProductCost(product, req.user));
  } catch (error) {
    next(error);
  }
});

// C4: Kelola produk, harga, staf: Ditolak untuk Staf tanpa izin (403), Boleh untuk Pemilik / Staf dengan izin MANAGE_PRODUCTS
productRouter.post('/', authenticate, requirePermissionOrRole(PERMISSIONS.MANAGE_PRODUCTS, 'PEMILIK'), async (req, res, next) => {
  try {
    const input = createProductSchema.parse(req.body);
    res.status(201).json(await createProduct(input));
  } catch (error) {
    next(error);
  }
});

productRouter.patch('/:id', authenticate, requirePermissionOrRole(PERMISSIONS.MANAGE_PRODUCTS, 'PEMILIK'), async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const input = updateProductSchema.parse(req.body);
    res.json(await updateProduct(id, input));
  } catch (error) {
    next(error);
  }
});

productRouter.patch('/:id/status', authenticate, requirePermissionOrRole(PERMISSIONS.MANAGE_PRODUCTS, 'PEMILIK'), async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const input = updateProductStatusSchema.parse(req.body);
    res.json(await setProductStatus(id, input));
  } catch (error) {
    next(error);
  }
});

productRouter.delete('/:id', authenticate, requirePermissionOrRole(PERMISSIONS.MANAGE_PRODUCTS, 'PEMILIK'), async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await deleteProduct(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
