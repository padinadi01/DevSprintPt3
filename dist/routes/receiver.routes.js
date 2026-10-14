"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.receiverRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const db_1 = require("../lib/db");
exports.receiverRouter = (0, express_1.Router)();
const list = async (_req, res, next) => {
    try {
        const receivers = await db_1.db.receiver.findMany({
            orderBy: { name: 'asc' },
        });
        res.json(receivers);
    }
    catch (error) {
        next(error);
    }
};
exports.receiverRouter.get('/', auth_middleware_1.authenticate, list);
