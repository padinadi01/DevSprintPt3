import { mockStore } from '../lib/mock-store';
import type { SupplierDto } from '../types/dto';
import type { CreateSupplierInput } from '../validators/supplier.validator';

export async function listSuppliers(): Promise<SupplierDto[]> {
  return mockStore.listSuppliers();
}

export async function createSupplier(input: CreateSupplierInput): Promise<SupplierDto> {
  return mockStore.createSupplier(input);
}
