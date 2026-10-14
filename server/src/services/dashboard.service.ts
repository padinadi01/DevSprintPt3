import { mockStore } from '../lib/mock-store';
import type { DashboardDto } from '../types/dto';

export async function getDashboard(): Promise<DashboardDto> {
  return mockStore.getDashboard();
}
