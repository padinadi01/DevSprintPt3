"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productRouter = void 0;
const express_1 = require("express");
const product_service_1 = require("../services/product.service");
const common_validator_1 = require("../validators/common.validator");
const product_validator_1 = require("../validators/product.validator");
const auth_middleware_1 = require("../middleware/auth.middleware");
// Route handlers stay thin: validate input with Zod, call a service, send the result.
exports.productRouter = (0, express_1.Router)();
// C3 & C6: Lihat katalog produk (Staf dan Pemilik). Harga modal disembunyikan untuk Staf
exports.productRouter.get('/', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const filter = product_validator_1.listProductsQuerySchema.parse(req.query);
        const products = await (0, product_service_1.listProducts)(filter);
        const masked = products.map((p) => (0, auth_middleware_1.maskProductCost)(p, req.user));
        res.json(masked);
    }
    catch (error) {
        next(error);
    }
});
exports.productRouter.get('/:id', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const { id } = common_validator_1.idParamSchema.parse(req.params);
        const product = await (0, product_service_1.getProduct)(id);
        res.json((0, auth_middleware_1.maskProductCost)(product, req.user));
    }
    catch (error) {
        next(error);
    }
});
// C4: Kelola produk, harga, staf: Ditolak untuk Staf tanpa izin (403), Boleh untuk Pemilik / Staf dengan izin MANAGE_PRODUCTS
exports.productRouter.post('/', auth_middleware_1.authenticate, (0, auth_middleware_1.requirePermissionOrRole)(auth_middleware_1.PERMISSIONS.MANAGE_PRODUCTS, 'PEMILIK'), async (req, res, next) => {
    try {
        const input = product_validator_1.createProductSchema.parse(req.body);
        res.status(201).json(await (0, product_service_1.createProduct)(input));
    }
    catch (error) {
        next(error);
    }
});
exports.productRouter.patch('/:id', auth_middleware_1.authenticate, (0, auth_middleware_1.requirePermissionOrRole)(auth_middleware_1.PERMISSIONS.MANAGE_PRODUCTS, 'PEMILIK'), async (req, res, next) => {
    try {
        const { id } = common_validator_1.idParamSchema.parse(req.params);
        const input = product_validator_1.updateProductSchema.parse(req.body);
        res.json(await (0, product_service_1.updateProduct)(id, input));
    }
    catch (error) {
        next(error);
    }
});
exports.productRouter.patch('/:id/status', auth_middleware_1.authenticate, (0, auth_middleware_1.requirePermissionOrRole)(auth_middleware_1.PERMISSIONS.MANAGE_PRODUCTS, 'PEMILIK'), async (req, res, next) => {
    try {
        const { id } = common_validator_1.idParamSchema.parse(req.params);
        const input = product_validator_1.updateProductStatusSchema.parse(req.body);
        res.json(await (0, product_service_1.setProductStatus)(id, input));
    }
    catch (error) {
        next(error);
    }
});
exports.productRouter.delete('/:id', auth_middleware_1.authenticate, (0, auth_middleware_1.requirePermissionOrRole)(auth_middleware_1.PERMISSIONS.MANAGE_PRODUCTS, 'PEMILIK'), async (req, res, next) => {
    try {
        const { id } = common_validator_1.idParamSchema.parse(req.params);
        await (0, product_service_1.deleteProduct)(id);
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
