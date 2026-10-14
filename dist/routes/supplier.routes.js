"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supplierRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const db_1 = require("../lib/db");
exports.supplierRouter = (0, express_1.Router)();
const list = async (_req, res, next) => {
    try {
        const data = await db_1.db.supplier.findMany({ orderBy: { name: 'asc' } });
        res.json(data);
    }
    catch (error) {
        next(error);
    }
};
exports.supplierRouter.get('/', auth_middleware_1.authenticate, list);
