"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.goodsReceiptRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const goodsReceiptService = __importStar(require("../services/goods-receipt.service"));
const goods_receipt_validator_1 = require("../validators/goods-receipt.validator");
exports.goodsReceiptRouter = (0, express_1.Router)();
// C3 & C6: List receipts (Staf & Pemilik). Harga modal disembunyikan untuk Staf
const list = async (req, res, next) => {
    try {
        const data = await goodsReceiptService.listGoodsReceipts();
        const masked = data.map((r) => (0, auth_middleware_1.maskGoodsReceiptCost)(r, req.user));
        res.json(masked);
    }
    catch (error) {
        next(error);
    }
};
const listClaims = async (req, res, next) => {
    try {
        const { supplierId, startDate, endDate } = req.query;
        const data = await goodsReceiptService.listRejectedClaims({
            supplierId,
            startDate,
            endDate,
        });
        res.json(data);
    }
    catch (error) {
        next(error);
    }
};
const getDetail = async (req, res, next) => {
    try {
        const data = await goodsReceiptService.getGoodsReceipt(req.params.id);
        res.json((0, auth_middleware_1.maskGoodsReceiptCost)(data, req.user));
    }
    catch (error) {
        next(error);
    }
};
// C5: Terima barang: Staf & Pemilik. Identitas penerima dipaksa dari sesi login
const create = async (req, res, next) => {
    try {
        // C5: Jika Staf, receiverId WAJIB dari identitas login, bukan dari body
        if (req.user?.role === 'STAF' && req.user.receiverId) {
            req.body.receiverId = req.user.receiverId;
        }
        else if (req.user?.role === 'PEMILIK' && !req.body.receiverId && req.user.receiverId) {
            req.body.receiverId = req.user.receiverId;
        }
        const input = goods_receipt_validator_1.createGoodsReceiptSchema.parse(req.body);
        const data = await goodsReceiptService.createGoodsReceipt(input);
        res.status(201).json((0, auth_middleware_1.maskGoodsReceiptCost)(data, req.user));
    }
    catch (error) {
        next(error);
    }
};
// C4: Reversal terima barang: Ditolak untuk Staf tanpa izin (403), Boleh untuk Pemilik / Staf dengan izin REVERSE_RECEIPT
const reverse = async (req, res, next) => {
    try {
        const input = goods_receipt_validator_1.reverseGoodsReceiptSchema.parse(req.body);
        if (!input.person && req.user?.name) {
            input.person = req.user.name;
        }
        const data = await goodsReceiptService.reverseGoodsReceipt(req.params.id, input);
        res.json((0, auth_middleware_1.maskGoodsReceiptCost)(data, req.user));
    }
    catch (error) {
        next(error);
    }
};
exports.goodsReceiptRouter.get('/', auth_middleware_1.authenticate, list);
exports.goodsReceiptRouter.get('/claims', auth_middleware_1.authenticate, listClaims);
exports.goodsReceiptRouter.post('/', auth_middleware_1.authenticate, create);
exports.goodsReceiptRouter.get('/:id', auth_middleware_1.authenticate, getDetail);
exports.goodsReceiptRouter.post('/:id/reverse', auth_middleware_1.authenticate, (0, auth_middleware_1.requirePermissionOrRole)(auth_middleware_1.PERMISSIONS.REVERSE_RECEIPT, 'PEMILIK'), reverse);
