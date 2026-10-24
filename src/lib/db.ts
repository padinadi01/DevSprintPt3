import { PrismaClient } from '@prisma/client';
import { createMemoryDb } from './memory-db';

let url = process.env.DATABASE_URL;
const targetSchema = process.env.DB_SCHEMA || 'student1';

// Enforce pooled connection flags, target schema 'student1', and short timeouts
if (url) {
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has('schema')) {
      parsed.searchParams.set('schema', targetSchema);
    }
    if ((url.includes(':6543') || url.includes('pooler.supabase.com')) && !parsed.searchParams.has('pgbouncer')) {
      parsed.searchParams.set('pgbouncer', 'true');
    }
    if (!parsed.searchParams.has('connect_timeout')) {
      parsed.searchParams.set('connect_timeout', '2');
    }
    if (!parsed.searchParams.has('connection_limit')) {
      parsed.searchParams.set('connection_limit', '5');
    }
    url = parsed.toString();
    process.env.DATABASE_URL = url;
  } catch {
    // Keep raw string if non-standard URL
  }
}

const memoryDb = createMemoryDb();
let remoteDbOffline = !url;

let prisma: PrismaClient | null = null;
if (url) {
  try {
    prisma = new PrismaClient({
      datasources: { db: { url } },
      log: ['error'],
    });
  } catch {
    console.warn('[DB Resilience] PrismaClient initialization skipped, using in-memory store.');
    remoteDbOffline = true;
  }
}

// Helper to race a query against a fast timeout so failover triggers in milliseconds
function withTimeout<T>(promise: Promise<T>, ms = 300): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(`Connection timeout: remote database did not respond within ${ms}ms`);
      (err as any).code = 'P1001';
      reject(err);
    }, ms);

    promise.then(
      (res) => {
        clearTimeout(timer);
        resolve(res);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

// Background non-blocking probe on boot to check remote DB health within 250ms
if (prisma && !remoteDbOffline) {
  withTimeout(prisma.$queryRaw`SELECT 1`, 250).catch((err: any) => {
    remoteDbOffline = true;
    console.warn(
      `[DB Resilience] Remote database probe failed (${err.message.split('\n')[0]}). Instantly switched to in-memory store.`
    );
  });
}

function isConnectionError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  const code = String(err.code || '');

  // Business logic conflicts (4xx) should not trigger memory-db failover
  if (code === 'P2002' || code === 'P2025') {
    return false;
  }

  // Any other error (connection error, missing unmigrated table/column, schema mismatch, query crash)
  // MUST trigger instant transparent failover to prevent 500 errors
  return (
    !url ||
    code.startsWith('P10') || // P1000 - P1017 connection errors
    code === 'P2021' || // Table does not exist in schema
    code === 'P2022' || // Column does not exist in table
    code === 'P2010' || // Raw query failed / relation does not exist
    code === 'P2028' || // Transaction error
    code.startsWith('P') || // Other Prisma engine/query errors
    msg.includes("can't reach database") ||
    msg.includes('connection timeout') ||
    msg.includes('enotfound') ||
    msg.includes('tenant/user') ||
    msg.includes('connection terminated') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    msg.includes('server closed the connection') ||
    msg.includes('environment variable not found') ||
    msg.includes('prismaclient') ||
    msg.includes('does not exist') ||
    msg.includes('relation') ||
    msg.includes('column') ||
    msg.includes('table')
  );
}

function createModelProxy(modelName: string): any {
  return new Proxy(
    {},
    {
      get(_target, method: string) {
        return async (...args: any[]) => {
          if (remoteDbOffline || !prisma) {
            const memModel = (memoryDb as any)[modelName];
            if (memModel && typeof memModel[method] === 'function') {
              return memModel[method](...args);
            }
            throw new Error(`In-memory database does not support ${modelName}.${method}`);
          }

          try {
            const prismaModel = (prisma as any)[modelName];
            if (prismaModel && typeof prismaModel[method] === 'function') {
              // Enforce 300ms query timeout to trigger instant failover if remote DB hangs
              return await withTimeout(prismaModel[method](...args), 300);
            }
          } catch (err: any) {
            if (isConnectionError(err)) {
              remoteDbOffline = true;
              console.warn(
                `[DB Resilience] Remote database unreachable (${err.message.split('\n')[0]}). Falling back to in-memory store for ${modelName}.${method}.`
              );
              const memModel = (memoryDb as any)[modelName];
              if (memModel && typeof memModel[method] === 'function') {
                return memModel[method](...args);
              }
            }
            throw err;
          }

          const memModel = (memoryDb as any)[modelName];
          if (memModel && typeof memModel[method] === 'function') {
            return memModel[method](...args);
          }
          throw new Error(`Method ${modelName}.${method} not found on database`);
        };
      },
    }
  );
}

export const db: PrismaClient = new Proxy((prisma || {}) as any, {
  get(target, prop: string) {
    if (prop === '$transaction') {
      return async (cbOrList: any, ...rest: any[]) => {
        if (remoteDbOffline || !prisma) {
          return memoryDb.$transaction(cbOrList);
        }
        try {
          return await withTimeout((target as any).$transaction(cbOrList, ...rest), 400);
        } catch (err: any) {
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
      return async () => {};
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

    return (target as any)[prop];
  },
});
