import { Router, type RequestHandler } from 'express';
import {
  authenticate,
  requirePermissionOrRole,
  PERMISSIONS,
  maskPurchaseOrderCost,
} from '../middleware/auth.middleware';
import * as purchaseOrderService from '../services/purchase-order.service';
import { createPurchaseOrderSchema } from '../validators/purchase-order.validator';

export const purchaseOrderRouter = Router();

// C3 & C6: List POs (Staf and Pemilik). Harga modal disembunyikan untuk Staf kecuali memiliki izin VIEW_COST
const list: RequestHandler = async (req, res, next) => {
  try {
    const data = await purchaseOrderService.listPurchaseOrders();
    const masked = data.map((po) => maskPurchaseOrderCost(po, req.user));
    res.json(masked);
  } catch (error) {
    next(error);
  }
};

const getDetail: RequestHandler = async (req, res, next) => {
  try {
    const data = await purchaseOrderService.getPurchaseOrder(req.params.id as string);
    res.json(maskPurchaseOrderCost(data, req.user));
  } catch (error) {
    next(error);
  }
};

// C4: Buat / tutup pesanan (PO): Pemilik atau Staf dengan izin CREATE_PO / CANCEL_PO
const create: RequestHandler = async (req, res, next) => {
  try {
    const input = createPurchaseOrderSchema.parse(req.body);
    const data = await purchaseOrderService.createPurchaseOrder(input);
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
};

const cancel: RequestHandler = async (req, res, next) => {
  try {
    const note = typeof req.body?.note === 'string' ? req.body.note : undefined;
    const data = await purchaseOrderService.cancelPurchaseOrder(req.params.id as string, note);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

purchaseOrderRouter.get('/', authenticate, list);
purchaseOrderRouter.post('/', authenticate, requirePermissionOrRole(PERMISSIONS.CREATE_PO, 'PEMILIK'), create);
purchaseOrderRouter.get('/:id', authenticate, getDetail);
purchaseOrderRouter.patch('/:id/cancel', authenticate, requirePermissionOrRole(PERMISSIONS.CANCEL_PO, 'PEMILIK'), cancel);
purchaseOrderRouter.post('/:id/cancel', authenticate, requirePermissionOrRole(PERMISSIONS.CANCEL_PO, 'PEMILIK'), cancel);

