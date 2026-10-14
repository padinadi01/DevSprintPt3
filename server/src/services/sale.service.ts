import { mockStore } from '../lib/mock-store';
import type { SaleDetailDto, SaleSummaryDto } from '../types/dto';
import type { CreateSaleInput } from '../validators/sale.validator';

export const saleSummaryInclude = {
  _count: { select: { items: true } },
};

export async function listSales(createdByUserId?: string): Promise<SaleSummaryDto[]> {
  return mockStore.listSales(createdByUserId);
}

export async function getSale(id: string, createdByUserId?: string): Promise<SaleDetailDto> {
  return mockStore.getSale(id, createdByUserId);
}

export async function createSale(input: CreateSaleInput, createdByUserId: string): Promise<SaleDetailDto> {
  return mockStore.createSale(input, createdByUserId);
}
