"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const client_1 = require("@prisma/client");
const memory_db_1 = require("./memory-db");
let url = process.env.DATABASE_URL;
if (url && (url.includes(':6543') || url.includes('pooler.supabase.com')) && !url.includes('pgbouncer=true')) {
    url += (url.includes('?') ? '&' : '?') + 'pgbouncer=true';
}
const prisma = new client_1.PrismaClient({
    datasources: url ? { db: { url } } : undefined,
    log: ['error'],
});
const memoryDb = (0, memory_db_1.createMemoryDb)();
let remoteDbOffline = false;
function isConnectionError(err) {
    if (!err)
        return false;
    const msg = String(err.message || '').toLowerCase();
    const code = String(err.code || '');
    return (code.startsWith('P10') || // P1000 - P1017 (Prisma connection/reachability errors)
        msg.includes("can't reach database") ||
        msg.includes('enotfound') ||
        msg.includes('tenant/user') ||
        msg.includes('connection terminated') ||
        msg.includes('econnrefused') ||
        msg.includes('etimedout') ||
        msg.includes('server closed the connection'));
}
function createModelProxy(modelName) {
    return new Proxy({}, {
        get(_target, method) {
            return async (...args) => {
                if (remoteDbOffline) {
                    const memModel = memoryDb[modelName];
                    if (memModel && typeof memModel[method] === 'function') {
                        return memModel[method](...args);
                    }
                    throw new Error(`In-memory database does not support ${modelName}.${method}`);
                }
                try {
                    const prismaModel = prisma[modelName];
                    if (prismaModel && typeof prismaModel[method] === 'function') {
                        return await prismaModel[method](...args);
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
exports.db = new Proxy(prisma, {
    get(target, prop) {
        if (prop === '$transaction') {
            return async (cbOrList, ...rest) => {
                if (remoteDbOffline) {
                    return memoryDb.$transaction(cbOrList);
                }
                try {
                    return await target.$transaction(cbOrList, ...rest);
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
