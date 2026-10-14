import { mockStore } from '../lib/mock-store';
import type {
  InventoryCheckSummaryDto,
  InventoryCheckDetailDto,
} from '../types/dto';
import type { CreateInventoryCheckInput } from '../validators/inventory.validator';

export async function listInventoryChecks(): Promise<InventoryCheckSummaryDto[]> {
  return mockStore.listInventoryChecks();
}

export async function getInventoryCheck(id: string): Promise<InventoryCheckDetailDto> {
  return mockStore.getInventoryCheck(id);
}

export async function createInventoryCheck(
  input: CreateInventoryCheckInput,
  checkedBy: string,
): Promise<InventoryCheckDetailDto> {
  return mockStore.createInventoryCheck(input, checkedBy);
}
