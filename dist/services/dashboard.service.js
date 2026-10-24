"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboard = getDashboard;
const constants_1 = require("../lib/constants");
const db_1 = require("../lib/db");
const dates_1 = require("../lib/dates");
const cache_1 = require("../lib/cache");
const product_service_1 = require("./product.service");
const sale_service_1 = require("./sale.service");
const DASHBOARD_CACHE_KEY = 'dashboard:metrics';
async function getDashboard() {
    const cached = cache_1.cache.get(DASHBOARD_CACHE_KEY);
    if (cached)
        return cached;
    const now = new Date();
    const activeWhere = { isActive: true };
    const lowStockWhere = { stock: { lte: constants_1.LOW_STOCK_THRESHOLD }, isActive: true };
    const [totalProducts, stockSum, todaySales, lowStockCount, latestSales, lowStockProducts] = await Promise.all([
        db_1.db.product.count({ where: activeWhere }),
        db_1.db.product.aggregate({ _sum: { stock: true }, where: activeWhere }),
        db_1.db.sale.aggregate({
            _sum: { total: true },
            where: { createdAt: { gte: (0, dates_1.startOfDayWib)(now), lt: (0, dates_1.endOfDayWib)(now) } },
        }),
        db_1.db.product.count({ where: lowStockWhere }),
        db_1.db.sale.findMany({
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: sale_service_1.saleSummaryInclude,
        }),
        db_1.db.product.findMany({
            where: lowStockWhere,
            orderBy: [{ stock: 'asc' }, { name: 'asc' }],
            take: 10,
        }),
    ]);
    const toNum = (val) => {
        if (!val)
            return 0;
        if (typeof val === 'number')
            return val;
        if (typeof val.toNumber === 'function')
            return val.toNumber();
        const n = Number(val);
        return isNaN(n) ? 0 : n;
    };
    const result = {
        totalProducts,
        totalUnits: stockSum._sum.stock ?? 0,
        todaySalesTotal: toNum(todaySales._sum.total),
        lowStockCount,
        lowStockThreshold: constants_1.LOW_STOCK_THRESHOLD,
        latestSales: latestSales.map(sale_service_1.toSaleSummaryDto),
        lowStockProducts: lowStockProducts.map(product_service_1.toProductDto),
    };
    cache_1.cache.set(DASHBOARD_CACHE_KEY, result, 15000);
    return result;
}
