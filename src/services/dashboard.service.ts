import { LOW_STOCK_THRESHOLD } from '../lib/constants';
import { db } from '../lib/db';
import { endOfDayWib, startOfDayWib } from '../lib/dates';
import { cache } from '../lib/cache';
import type { DashboardDto } from '../types/dto';
import { toProductDto } from './product.service';
import { saleSummaryInclude, toSaleSummaryDto } from './sale.service';

const DASHBOARD_CACHE_KEY = 'dashboard:metrics';

export async function getDashboard(): Promise<DashboardDto> {
  const cached = cache.get<DashboardDto>(DASHBOARD_CACHE_KEY);
  if (cached) return cached;

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

  const toNum = (val: any) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    if (typeof val.toNumber === 'function') return val.toNumber();
    const n = Number(val);
    return isNaN(n) ? 0 : n;
  };

  const result: DashboardDto = {
    totalProducts,
    totalUnits: stockSum._sum.stock ?? 0,
    todaySalesTotal: toNum(todaySales._sum.total),
    lowStockCount,
    lowStockThreshold: LOW_STOCK_THRESHOLD,
    latestSales: latestSales.map(toSaleSummaryDto),
    lowStockProducts: lowStockProducts.map(toProductDto),
  };

  cache.set(DASHBOARD_CACHE_KEY, result, 15000);
  return result;
}
