"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const dashboard_service_1 = require("../services/dashboard.service");
exports.dashboardRouter = (0, express_1.Router)();
// Dashboard Omzet & Laba: Pemilik atau Staf dengan izin VIEW_DASHBOARD
exports.dashboardRouter.get('/', auth_middleware_1.authenticate, (0, auth_middleware_1.requirePermissionOrRole)(auth_middleware_1.PERMISSIONS.VIEW_DASHBOARD, 'PEMILIK'), async (_req, res, next) => {
    try {
        res.json(await (0, dashboard_service_1.getDashboard)());
    }
    catch (error) {
        next(error);
    }
});
