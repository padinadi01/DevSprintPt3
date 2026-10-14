import type { InventoryCheckSummary, InventoryCheckDetail, InventoryCheckInput } from '../types/api';
import { request } from './http';

export function listInventoryChecks(): Promise<InventoryCheckSummary[]> {
  return request<InventoryCheckSummary[]>('/inventory-checks');
}

export function getInventoryCheck(id: string): Promise<InventoryCheckDetail> {
  return request<InventoryCheckDetail>(`/inventory-checks/${id}`);
}

export function createInventoryCheck(input: InventoryCheckInput): Promise<InventoryCheckDetail> {
  return request<InventoryCheckDetail>('/inventory-checks', { method: 'POST', body: input });
}
