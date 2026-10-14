import type { RestockOrderSummary, RestockOrderDetail, RestockOrderInput, RestockReceiptInput } from '../types/api';
import { request } from './http';

export function listRestockOrders(): Promise<RestockOrderSummary[]> {
  return request<RestockOrderSummary[]>('/restock-orders');
}

export function getRestockOrder(id: string): Promise<RestockOrderDetail> {
  return request<RestockOrderDetail>(`/restock-orders/${id}`);
}

export function createRestockOrder(input: RestockOrderInput): Promise<RestockOrderDetail> {
  return request<RestockOrderDetail>('/restock-orders', { method: 'POST', body: input });
}

export function cancelRestockOrder(id: string): Promise<RestockOrderDetail> {
  return request<RestockOrderDetail>(`/restock-orders/${id}/cancel`, { method: 'PATCH' });
}

export function createRestockReceipt(orderId: string, input: RestockReceiptInput): Promise<RestockOrderDetail> {
  return request<RestockOrderDetail>(`/restock-orders/${orderId}/receipts`, { method: 'POST', body: input });
}
