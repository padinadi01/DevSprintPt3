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
exports.purchaseOrderRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const purchaseOrderService = __importStar(require("../services/purchase-order.service"));
const purchase_order_validator_1 = require("../validators/purchase-order.validator");
exports.purchaseOrderRouter = (0, express_1.Router)();
// C3 & C6: List POs (Staf and Pemilik). Harga modal disembunyikan untuk Staf kecuali memiliki izin VIEW_COST
const list = async (req, res, next) => {
    try {
        const data = await purchaseOrderService.listPurchaseOrders();
        const masked = data.map((po) => (0, auth_middleware_1.maskPurchaseOrderCost)(po, req.user));
        res.json(masked);
    }
    catch (error) {
        next(error);
    }
};
const getDetail = async (req, res, next) => {
    try {
        const data = await purchaseOrderService.getPurchaseOrder(req.params.id);
        res.json((0, auth_middleware_1.maskPurchaseOrderCost)(data, req.user));
    }
    catch (error) {
        next(error);
    }
};
// C4: Buat / tutup pesanan (PO): Pemilik atau Staf dengan izin CREATE_PO / CANCEL_PO
const create = async (req, res, next) => {
    try {
        const input = purchase_order_validator_1.createPurchaseOrderSchema.parse(req.body);
        const data = await purchaseOrderService.createPurchaseOrder(input);
        res.status(201).json(data);
    }
    catch (error) {
        next(error);
    }
};
const cancel = async (req, res, next) => {
    try {
        const note = typeof req.body?.note === 'string' ? req.body.note : undefined;
        const data = await purchaseOrderService.cancelPurchaseOrder(req.params.id, note);
        res.json(data);
    }
    catch (error) {
        next(error);
    }
};
exports.purchaseOrderRouter.get('/', auth_middleware_1.authenticate, list);
exports.purchaseOrderRouter.post('/', auth_middleware_1.authenticate, (0, auth_middleware_1.requirePermissionOrRole)(auth_middleware_1.PERMISSIONS.CREATE_PO, 'PEMILIK'), create);
exports.purchaseOrderRouter.get('/:id', auth_middleware_1.authenticate, getDetail);
exports.purchaseOrderRouter.patch('/:id/cancel', auth_middleware_1.authenticate, (0, auth_middleware_1.requirePermissionOrRole)(auth_middleware_1.PERMISSIONS.CANCEL_PO, 'PEMILIK'), cancel);
exports.purchaseOrderRouter.post('/:id/cancel', auth_middleware_1.authenticate, (0, auth_middleware_1.requirePermissionOrRole)(auth_middleware_1.PERMISSIONS.CANCEL_PO, 'PEMILIK'), cancel);
