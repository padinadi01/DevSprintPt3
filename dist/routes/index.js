"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRouter = void 0;
const express_1 = require("express");
const auth_routes_1 = require("./auth.routes");
const dashboard_routes_1 = require("./dashboard.routes");
const goods_receipt_routes_1 = require("./goods-receipt.routes");
const product_routes_1 = require("./product.routes");
const purchase_order_routes_1 = require("./purchase-order.routes");
const receiver_routes_1 = require("./receiver.routes");
const sale_routes_1 = require("./sale.routes");
const stock_routes_1 = require("./stock.routes");
const supplier_routes_1 = require("./supplier.routes");
// Everything below is mounted under /api (see app.ts).
exports.apiRouter = (0, express_1.Router)();
// Public & Session routes
exports.apiRouter.use('/auth', auth_routes_1.authRouter);
// Protected routes
exports.apiRouter.use('/products', product_routes_1.productRouter);
exports.apiRouter.use('/purchase-orders', purchase_order_routes_1.purchaseOrderRouter);
exports.apiRouter.use('/goods-receipts', goods_receipt_routes_1.goodsReceiptRouter);
exports.apiRouter.use('/receivers', receiver_routes_1.receiverRouter);
exports.apiRouter.use('/suppliers', supplier_routes_1.supplierRouter);
exports.apiRouter.use('/sales', sale_routes_1.saleRouter);
exports.apiRouter.use('/dashboard', dashboard_routes_1.dashboardRouter);
exports.apiRouter.use('/stock', stock_routes_1.stockRouter); // /stock/movements and /stock/adjustments
exports.apiRouter.use('/', stock_routes_1.stockRouter); // /stock-adjustments and /stock-movements
