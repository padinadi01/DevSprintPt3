import { mockStore } from '../lib/mock-store';
import type { StockMovementDto } from '../types/dto';
import type {
  ListStockMovementsFilter,
  StockAdjustmentInput,
} from '../validators/stock.validator';

export async function adjustStock(input: StockAdjustmentInput): Promise<StockMovementDto> {
  return mockStore.adjustStock(input);
}

export async function listStockMovements(
  filter: ListStockMovementsFilter,
): Promise<StockMovementDto[]> {
  return mockStore.listStockMovements(filter);
}
