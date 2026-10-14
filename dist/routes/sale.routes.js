"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saleRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const sale_service_1 = require("../services/sale.service");
const common_validator_1 = require("../validators/common.validator");
const sale_validator_1 = require("../validators/sale.validator");
exports.saleRouter = (0, express_1.Router)();
exports.saleRouter.get('/', auth_middleware_1.authenticate, async (_req, res, next) => {
    try {
        res.json(await (0, sale_service_1.listSales)());
    }
    catch (error) {
        next(error);
    }
});
exports.saleRouter.get('/:id', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const { id } = common_validator_1.idParamSchema.parse(req.params);
        res.json(await (0, sale_service_1.getSale)(id));
    }
    catch (error) {
        next(error);
    }
});
exports.saleRouter.post('/', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const input = sale_validator_1.createSaleSchema.parse(req.body);
        res.status(201).json(await (0, sale_service_1.createSale)(input));
    }
    catch (error) {
        next(error);
    }
});
