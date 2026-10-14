import { PrismaClient } from '@prisma/client';

// The one shared Prisma client. Every service imports `db` from here.
export const db = new PrismaClient({ log: ['warn', 'error'] });
