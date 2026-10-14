"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// dotenv must load before anything that reads process.env (Prisma reads DATABASE_URL).
require("dotenv/config");
const app_1 = require("./app");
const db_1 = require("./lib/db");
const port = Number(process.env.PORT ?? 4000);
const server = app_1.app.listen(port, () => {
    console.log(`API berjalan di http://localhost:${port}`);
});
async function shutdown() {
    server.close();
    await db_1.db.$disconnect();
    process.exit(0);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
