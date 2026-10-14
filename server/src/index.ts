// dotenv must load before anything that reads process.env (Prisma reads DATABASE_URL).
import 'dotenv/config';
import { app } from './app';
import { db } from './lib/db';

const port = Number(process.env.PORT ?? 4000);

const server = app.listen(port, () => {
  console.log(`API berjalan di http://localhost:${port}`);
});

async function shutdown(): Promise<void> {
  server.close();
  await db.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
