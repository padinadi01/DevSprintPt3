import { LOW_STOCK_THRESHOLD } from '../lib/constants';
import { db } from '../lib/db';
import { endOfDayWib, startOfDayWib } from '../lib/dates';
import type { DashboardDto } from '../types/dto';
import { toProductDto } from './product.service';
import { saleSummaryInclude, toSaleSummaryDto } from './sale.service';

export async function getDashboard(): Promise<DashboardDto> {
  const now = new Date();
  const activeWhere = { isActive: true };
  const lowStockWhere = { stock: { lte: LOW_STOCK_THRESHOLD }, isActive: true };

  const [totalProducts, stockSum, todaySales, lowStockCount, latestSales, lowStockProducts] =
    await Promise.all([
      db.product.count({ where: activeWhere }),
      db.product.aggregate({ _sum: { stock: true }, where: activeWhere }),
      db.sale.aggregate({
        _sum: { total: true },
        where: { createdAt: { gte: startOfDayWib(now), lt: endOfDayWib(now) } },
      }),
      db.product.count({ where: lowStockWhere }),
      db.sale.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: saleSummaryInclude,
      }),
      db.product.findMany({
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
    lowStockThreshold: LOW_STOCK_THRESHOLD,
    latestSales: latestSales.map(toSaleSummaryDto),
    lowStockProducts: lowStockProducts.map(toProductDto),
  };
}
