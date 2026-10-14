import type { Receiver } from '../types/api';
import { request } from './http';

export async function getReceivers(): Promise<Receiver[]> {
  return request<Receiver[]>('/receivers');
}
