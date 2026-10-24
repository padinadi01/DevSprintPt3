// Fast in-memory cache with TTL and key-prefix invalidation
// Used for frequently read, rarely changed data (dashboard metrics, product catalog, user list)

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<any>>();

export const cache = {
  get<T>(key: string): T | null {
    const entry = store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return null;
    }
    return entry.data as T;
  },

  set<T>(key: string, data: T, ttlMs = 15000): void {
    store.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  },

  invalidate(prefixOrKey: string): void {
    for (const key of store.keys()) {
      if (key === prefixOrKey || key.startsWith(prefixOrKey)) {
        store.delete(key);
      }
    }
  },

  clear(): void {
    store.clear();
  },
};
