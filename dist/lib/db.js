"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const client_1 = require("@prisma/client");
// The one shared Prisma client. Every service imports `db` from here.
let url = process.env.DATABASE_URL;
if (url && (url.includes(':6543') || url.includes('pooler.supabase.com')) && !url.includes('pgbouncer=true')) {
  url += (url.includes('?') ? '&' : '?') + 'pgbouncer=true';
}
exports.db = new client_1.PrismaClient({
  datasources: url ? { db: { url } } : undefined,
  log: ['warn', 'error'],
});
