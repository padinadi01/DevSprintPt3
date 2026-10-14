"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboard = getDashboard;
const constants_1 = require("../lib/constants");
const db_1 = require("../lib/db");
const dates_1 = require("../lib/dates");
const product_service_1 = require("./product.service");
const sale_service_1 = require("./sale.service");
async function getDashboard() {
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
    return {
        totalProducts,
        totalUnits: stockSum._sum.stock ?? 0,
        todaySalesTotal: todaySales._sum.total?.toNumber() ?? 0,
        lowStockCount,
        lowStockThreshold: constants_1.LOW_STOCK_THRESHOLD,
        latestSales: latestSales.map(sale_service_1.toSaleSummaryDto),
        lowStockProducts: lowStockProducts.map(product_service_1.toProductDto),
    };
}
