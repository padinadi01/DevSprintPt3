import type { PurchaseOrder, PurchaseOrderInput } from '../types/api';
import { request } from './http';

export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
  return request<PurchaseOrder[]>('/purchase-orders');
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrder> {
  return request<PurchaseOrder>(`/purchase-orders/${id}`);
}

export async function createPurchaseOrder(data: PurchaseOrderInput): Promise<PurchaseOrder> {
  return request<PurchaseOrder>('/purchase-orders', {
    method: 'POST',
    body: data,
  });
}

export async function cancelPurchaseOrder(id: string, note?: string): Promise<PurchaseOrder> {
  return request<PurchaseOrder>(`/purchase-orders/${id}/cancel`, {
    method: 'PATCH',
    body: { note },
  });
}
