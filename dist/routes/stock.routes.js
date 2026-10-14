"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stockRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const stock_service_1 = require("../services/stock.service");
const stock_validator_1 = require("../validators/stock.validator");
exports.stockRouter = (0, express_1.Router)();
// C4: Koreksi stok: Pemilik atau Staf dengan izin ADJUST_STOCK
exports.stockRouter.post('/stock-adjustments', auth_middleware_1.authenticate, (0, auth_middleware_1.requirePermissionOrRole)(auth_middleware_1.PERMISSIONS.ADJUST_STOCK, 'PEMILIK'), async (req, res, next) => {
    try {
        const input = stock_validator_1.stockAdjustmentSchema.parse(req.body);
        // Identity binding: if not provided or to ensure audit, enforce person = user.name
        if (!input.person && req.user?.name) {
            input.person = req.user.name;
        }
        res.status(201).json(await (0, stock_service_1.adjustStock)(input));
    }
    catch (error) {
        next(error);
    }
});
// C3: Lihat riwayat pergerakan stok: Staf & Pemilik
exports.stockRouter.get('/stock-movements', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const filter = stock_validator_1.listStockMovementsQuerySchema.parse(req.query);
        res.json(await (0, stock_service_1.listStockMovements)(filter));
    }
    catch (error) {
        next(error);
    }
});
