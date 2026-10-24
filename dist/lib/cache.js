"use strict";
// Fast in-memory cache with TTL and key-prefix invalidation
// Used for frequently read, rarely changed data (dashboard metrics, product catalog, user list)
Object.defineProperty(exports, "__esModule", { value: true });
exports.cache = void 0;
const store = new Map();
exports.cache = {
    get(key) {
        const entry = store.get(key);
        if (!entry)
            return null;
        if (Date.now() > entry.expiresAt) {
            store.delete(key);
            return null;
        }
        return entry.data;
    },
    set(key, data, ttlMs = 15000) {
        store.set(key, {
            data,
            expiresAt: Date.now() + ttlMs,
        });
    },
    invalidate(prefixOrKey) {
        for (const key of store.keys()) {
            if (key === prefixOrKey || key.startsWith(prefixOrKey)) {
                store.delete(key);
            }
        }
    },
    clear() {
        store.clear();
    },
};
