import type {
  CreateGoodsReceiptInput,
  GoodsReceipt,
  RejectedClaimItem,
  ReverseGoodsReceiptInput,
} from '../types/api';
import { request } from './http';

export async function createGoodsReceipt(input: CreateGoodsReceiptInput): Promise<GoodsReceipt> {
  return request<GoodsReceipt>('/goods-receipts', {
    method: 'POST',
    body: input,
  });
}

export async function getGoodsReceipts(): Promise<GoodsReceipt[]> {
  return request<GoodsReceipt[]>('/goods-receipts');
}

export async function getGoodsReceipt(id: string): Promise<GoodsReceipt> {
  return request<GoodsReceipt>(`/goods-receipts/${id}`);
}

export async function reverseGoodsReceipt(
  id: string,
  input: ReverseGoodsReceiptInput
): Promise<GoodsReceipt> {
  return request<GoodsReceipt>(`/goods-receipts/${id}/reverse`, {
    method: 'POST',
    body: input,
  });
}

export async function getRejectedClaims(params?: {
  supplierId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<RejectedClaimItem[]> {
  const query = new URLSearchParams();
  if (params?.supplierId) query.set('supplierId', params.supplierId);
  if (params?.startDate) query.set('startDate', params.startDate);
  if (params?.endDate) query.set('endDate', params.endDate);
  const qStr = query.toString();
  return request<RejectedClaimItem[]>(`/goods-receipts/claims${qStr ? `?${qStr}` : ''}`);
}
