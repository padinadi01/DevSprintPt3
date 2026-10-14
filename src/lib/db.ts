import { PrismaClient } from '@prisma/client';

let url = process.env.DATABASE_URL;
if (url && (url.includes(':6543') || url.includes('pooler.supabase.com')) && !url.includes('pgbouncer=true')) {
  url += (url.includes('?') ? '&' : '?') + 'pgbouncer=true';
}

// The one shared Prisma client. Every service imports `db` from here.
export const db = new PrismaClient({
  datasources: url ? { db: { url } } : undefined,
  log: ['warn', 'error'],
});
