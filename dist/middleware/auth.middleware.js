"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermissionOrRole = exports.requireRole = exports.PERMISSIONS = exports.authenticate = void 0;
exports.checkLoginRateLimit = checkLoginRateLimit;
exports.recordFailedLogin = recordFailedLogin;
exports.clearFailedLogin = clearFailedLogin;
exports.maskProductCost = maskProductCost;
exports.maskGoodsReceiptCost = maskGoodsReceiptCost;
exports.maskPurchaseOrderCost = maskPurchaseOrderCost;
const client_1 = require("@prisma/client");
const auth_service_1 = require("../services/auth.service");
const errors_1 = require("../lib/errors");
const failedLoginAttempts = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 menit
function checkLoginRateLimit(key) {
    const now = Date.now();
    const record = failedLoginAttempts.get(key);
    if (record) {
        if (now - record.firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
            failedLoginAttempts.delete(key);
            return;
        }
        if (record.count >= MAX_FAILED_ATTEMPTS) {
            const remainingSeconds = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - record.firstAttemptAt)) / 1000);
            throw new errors_1.TooManyRequestsError(`Terlalu banyak percobaan login gagal. Silakan coba lagi setelah ${remainingSeconds} detik.`);
        }
    }
}
function recordFailedLogin(key) {
    const now = Date.now();
    const record = failedLoginAttempts.get(key);
    if (!record || now - record.firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
        failedLoginAttempts.set(key, { count: 1, firstAttemptAt: now });
    }
    else {
        record.count += 1;
    }
}
function clearFailedLogin(key) {
    failedLoginAttempts.delete(key);
}
// ---------------------------------------------------------------------------
// Authentication Middleware (C3)
// ---------------------------------------------------------------------------
const authenticate = (req, _res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : req.headers['x-auth-token'];
    if (!token) {
        throw new errors_1.UnauthorizedError('Autentikasi diperlukan. Silakan login terlebih dahulu.');
    }
    try {
        const user = (0, auth_service_1.verifyAuthToken)(token);
        req.user = user;
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.authenticate = authenticate;
// ---------------------------------------------------------------------------
// Role & Permission Authorization Middleware (C4 + Custom Staff Access)
// Deny by default: if user's role/permission is not authorized, reject with 403
// ---------------------------------------------------------------------------
exports.PERMISSIONS = {
    VIEW_DASHBOARD: 'VIEW_DASHBOARD',
    CREATE_PO: 'CREATE_PO',
    CANCEL_PO: 'CANCEL_PO',
    ADJUST_STOCK: 'ADJUST_STOCK',
    VIEW_COST: 'VIEW_COST',
    MANAGE_PRODUCTS: 'MANAGE_PRODUCTS',
    REVERSE_RECEIPT: 'REVERSE_RECEIPT',
};
const requireRole = (...allowedRoles) => {
    return (req, _res, next) => {
        if (!req.user) {
            throw new errors_1.UnauthorizedError('Autentikasi diperlukan. Silakan login terlebih dahulu.');
        }
        if (!allowedRoles.includes(req.user.role)) {
            throw new errors_1.ForbiddenError(`Akses ditolak: peran ${req.user.role} tidak memiliki izin untuk aksi ini.`);
        }
        next();
    };
};
exports.requireRole = requireRole;
const requirePermissionOrRole = (permission, ...allowedRoles) => {
    return (req, _res, next) => {
        if (!req.user) {
            throw new errors_1.UnauthorizedError('Autentikasi diperlukan. Silakan login terlebih dahulu.');
        }
        // Pemilik always has full access
        if (req.user.role === client_1.UserRole.PEMILIK) {
            return next();
        }
        // Role check
        if (allowedRoles.includes(req.user.role)) {
            return next();
        }
        // Specific permission granted to staff
        if (req.user.permissions && req.user.permissions.includes(permission)) {
            return next();
        }
        throw new errors_1.ForbiddenError(`Akses ditolak: akun ${req.user.name} (${req.user.role}) tidak memiliki izin "${permission}".`);
    };
};
exports.requirePermissionOrRole = requirePermissionOrRole;
// ---------------------------------------------------------------------------
// Response Cost Masking Helpers (C6 + VIEW_COST permission)
// ---------------------------------------------------------------------------
function maskProductCost(product, roleOrUser) {
    const role = typeof roleOrUser === 'string' ? roleOrUser : roleOrUser?.role;
    const permissions = typeof roleOrUser === 'object' ? roleOrUser?.permissions : undefined;
    const canSeeCost = role === client_1.UserRole.PEMILIK || (permissions && permissions.includes(exports.PERMISSIONS.VIEW_COST));
    if (!canSeeCost) {
        const { purchasePrice, ...rest } = product;
        return rest;
    }
    return product;
}
function maskGoodsReceiptCost(receipt, roleOrUser) {
    const role = typeof roleOrUser === 'string' ? roleOrUser : roleOrUser?.role;
    const permissions = typeof roleOrUser === 'object' ? roleOrUser?.permissions : undefined;
    const canSeeCost = role === client_1.UserRole.PEMILIK || (permissions && permissions.includes(exports.PERMISSIONS.VIEW_COST));
    if (!canSeeCost) {
        const masked = { ...receipt };
        if (Array.isArray(masked.items)) {
            masked.items = masked.items.map((item) => {
                const { unitCostPerPurchaseUnit, unitCostPerBaseUnit, ...rest } = item;
                return rest;
            });
        }
        return masked;
    }
    return receipt;
}
function maskPurchaseOrderCost(po, roleOrUser) {
    const role = typeof roleOrUser === 'string' ? roleOrUser : roleOrUser?.role;
    const permissions = typeof roleOrUser === 'object' ? roleOrUser?.permissions : undefined;
    const canSeeCost = role === client_1.UserRole.PEMILIK || (permissions && permissions.includes(exports.PERMISSIONS.VIEW_COST));
    if (!canSeeCost) {
        const masked = { ...po };
        if (Array.isArray(masked.receipts)) {
            masked.receipts = masked.receipts.map((r) => maskGoodsReceiptCost(r, roleOrUser));
        }
        return masked;
    }
    return po;
}
