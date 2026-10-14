import { mockStore } from '../lib/mock-store';
import type {
  RestockOrderSummaryDto,
  RestockOrderDetailDto,
} from '../types/dto';
import type {
  CreateRestockOrderInput,
  CreateRestockReceiptInput,
} from '../validators/restock.validator';

export async function listRestockOrders(): Promise<RestockOrderSummaryDto[]> {
  return mockStore.listRestockOrders();
}

export async function getRestockOrder(id: string): Promise<RestockOrderDetailDto> {
  return mockStore.getRestockOrder(id);
}

export async function createRestockOrder(input: CreateRestockOrderInput): Promise<RestockOrderDetailDto> {
  return mockStore.createRestockOrder(input);
}

export async function cancelRestockOrder(id: string): Promise<RestockOrderDetailDto> {
  return mockStore.cancelRestockOrder(id);
}

export async function createRestockReceipt(
  orderId: string,
  receivedBy: string,
  input: CreateRestockReceiptInput,
): Promise<RestockOrderDetailDto> {
  return mockStore.createRestockReceipt(orderId, receivedBy, input);
}
