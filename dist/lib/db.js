"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const client_1 = require("@prisma/client");
const memory_db_1 = require("./memory-db");
let url = process.env.DATABASE_URL;
if (url && (url.includes(':6543') || url.includes('pooler.supabase.com')) && !url.includes('pgbouncer=true')) {
    url += (url.includes('?') ? '&' : '?') + 'pgbouncer=true';
}
// Enforce short connection timeout and connection pooling limits to prevent hanging
if (url) {
    try {
        const parsed = new URL(url);
        if (!parsed.searchParams.has('connect_timeout')) {
            parsed.searchParams.set('connect_timeout', '2');
        }
        if (!parsed.searchParams.has('connection_limit')) {
            parsed.searchParams.set('connection_limit', '5');
        }
        url = parsed.toString();
    }
    catch {
        // Keep raw string if non-standard URL
    }
}
const memoryDb = (0, memory_db_1.createMemoryDb)();
let remoteDbOffline = !url;
let prisma = null;
if (url) {
    try {
        prisma = new client_1.PrismaClient({
            datasources: { db: { url } },
            log: ['error'],
        });
    }
    catch {
        console.warn('[DB Resilience] PrismaClient initialization skipped, using in-memory store.');
        remoteDbOffline = true;
    }
}
// Helper to race a query against a fast timeout so failover triggers in milliseconds
function withTimeout(promise, ms = 300) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            const err = new Error(`Connection timeout: remote database did not respond within ${ms}ms`);
            err.code = 'P1001';
            reject(err);
        }, ms);
        promise.then((res) => {
            clearTimeout(timer);
            resolve(res);
        }, (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}
// Background non-blocking probe on boot to check remote DB health within 250ms
if (prisma && !remoteDbOffline) {
    withTimeout(prisma.$queryRaw `SELECT 1`, 250).catch((err) => {
        remoteDbOffline = true;
        console.warn(`[DB Resilience] Remote database probe failed (${err.message.split('\n')[0]}). Instantly switched to in-memory store.`);
    });
}
function isConnectionError(err) {
    if (!err)
        return false;
    const msg = String(err.message || '').toLowerCase();
    const code = String(err.code || '');
    return (!url ||
        code.startsWith('P10') || // P1000 - P1017 (Prisma connection/reachability errors)
        msg.includes("can't reach database") ||
        msg.includes('connection timeout') ||
        msg.includes('enotfound') ||
        msg.includes('tenant/user') ||
        msg.includes('connection terminated') ||
        msg.includes('econnrefused') ||
        msg.includes('etimedout') ||
        msg.includes('server closed the connection') ||
        msg.includes('environment variable not found') ||
        msg.includes('prismaclientinitializationerror'));
}
function createModelProxy(modelName) {
    return new Proxy({}, {
        get(_target, method) {
            return async (...args) => {
                if (remoteDbOffline || !prisma) {
                    const memModel = memoryDb[modelName];
                    if (memModel && typeof memModel[method] === 'function') {
                        return memModel[method](...args);
                    }
                    throw new Error(`In-memory database does not support ${modelName}.${method}`);
                }
                try {
                    const prismaModel = prisma[modelName];
                    if (prismaModel && typeof prismaModel[method] === 'function') {
                        // Enforce 300ms query timeout to trigger instant failover if remote DB hangs
                        return await withTimeout(prismaModel[method](...args), 300);
                    }
                }
                catch (err) {
                    if (isConnectionError(err)) {
                        remoteDbOffline = true;
                        console.warn(`[DB Resilience] Remote database unreachable (${err.message.split('\n')[0]}). Falling back to in-memory store for ${modelName}.${method}.`);
                        const memModel = memoryDb[modelName];
                        if (memModel && typeof memModel[method] === 'function') {
                            return memModel[method](...args);
                        }
                    }
                    throw err;
                }
                const memModel = memoryDb[modelName];
                if (memModel && typeof memModel[method] === 'function') {
                    return memModel[method](...args);
                }
                throw new Error(`Method ${modelName}.${method} not found on database`);
            };
        },
    });
}
exports.db = new Proxy((prisma || {}), {
    get(target, prop) {
        if (prop === '$transaction') {
            return async (cbOrList, ...rest) => {
                if (remoteDbOffline || !prisma) {
                    return memoryDb.$transaction(cbOrList);
                }
                try {
                    return await withTimeout(target.$transaction(cbOrList, ...rest), 400);
                }
                catch (err) {
                    if (isConnectionError(err)) {
                        remoteDbOffline = true;
                        console.warn(`[DB Resilience] Transaction failed on remote DB. Falling back to in-memory transaction.`);
                        return memoryDb.$transaction(cbOrList);
                    }
                    throw err;
                }
            };
        }
        if (prop === '$connect' || prop === '$disconnect') {
            return async () => { };
        }
        // Known models
        const models = [
            'user',
            'product',
            'stockMovement',
            'goodsReceipt',
            'goodsReceiptItem',
            'purchaseOrder',
            'purchaseOrderItem',
            'sale',
            'saleItem',
            'receiver',
            'supplier',
        ];
        if (models.includes(prop)) {
            return createModelProxy(prop);
        }
        return target[prop];
    },
});
