import type { Supplier } from '../types/api';
import { request } from './http';

export async function getSuppliers(): Promise<Supplier[]> {
  return request<Supplier[]>('/suppliers');
}
