import { Router, type RequestHandler } from 'express';
import {
  authenticate,
  requirePermissionOrRole,
  PERMISSIONS,
  maskGoodsReceiptCost,
} from '../middleware/auth.middleware';
import * as goodsReceiptService from '../services/goods-receipt.service';
import {
  createGoodsReceiptSchema,
  reverseGoodsReceiptSchema,
} from '../validators/goods-receipt.validator';

export const goodsReceiptRouter = Router();

// C3 & C6: List receipts (Staf & Pemilik). Harga modal disembunyikan untuk Staf
const list: RequestHandler = async (req, res, next) => {
  try {
    const data = await goodsReceiptService.listGoodsReceipts();
    const masked = data.map((r) => maskGoodsReceiptCost(r, req.user));
    res.json(masked);
  } catch (error) {
    next(error);
  }
};

const listClaims: RequestHandler = async (req, res, next) => {
  try {
    const { supplierId, startDate, endDate } = req.query as {
      supplierId?: string;
      startDate?: string;
      endDate?: string;
    };
    const data = await goodsReceiptService.listRejectedClaims({
      supplierId,
      startDate,
      endDate,
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
};

const getDetail: RequestHandler = async (req, res, next) => {
  try {
    const data = await goodsReceiptService.getGoodsReceipt(req.params.id as string);
    res.json(maskGoodsReceiptCost(data, req.user));
  } catch (error) {
    next(error);
  }
};

// C5: Terima barang: Staf & Pemilik. Identitas penerima dipaksa dari sesi login
const create: RequestHandler = async (req, res, next) => {
  try {
    // C5: Jika Staf, receiverId WAJIB dari identitas login, bukan dari body
    if (req.user?.role === 'STAF' && req.user.receiverId) {
      req.body.receiverId = req.user.receiverId;
    } else if (req.user?.role === 'PEMILIK' && !req.body.receiverId && req.user.receiverId) {
      req.body.receiverId = req.user.receiverId;
    }

    const input = createGoodsReceiptSchema.parse(req.body);
    const data = await goodsReceiptService.createGoodsReceipt(input);
    res.status(201).json(maskGoodsReceiptCost(data, req.user));
  } catch (error) {
    next(error);
  }
};

// C4: Reversal terima barang: Ditolak untuk Staf tanpa izin (403), Boleh untuk Pemilik / Staf dengan izin REVERSE_RECEIPT
const reverse: RequestHandler = async (req, res, next) => {
  try {
    const input = reverseGoodsReceiptSchema.parse(req.body);
    if (!input.person && req.user?.name) {
      input.person = req.user.name;
    }
    const data = await goodsReceiptService.reverseGoodsReceipt(req.params.id as string, input);
    res.json(maskGoodsReceiptCost(data, req.user));
  } catch (error) {
    next(error);
  }
};

goodsReceiptRouter.get('/', authenticate, list);
goodsReceiptRouter.get('/claims', authenticate, listClaims);
goodsReceiptRouter.post('/', authenticate, create);
goodsReceiptRouter.get('/:id', authenticate, getDetail);
goodsReceiptRouter.post('/:id/reverse', authenticate, requirePermissionOrRole(PERMISSIONS.REVERSE_RECEIPT, 'PEMILIK'), reverse);
