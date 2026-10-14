import type { Product, ProductInput, ProductUpdateInput } from '../types/api';
import { request } from './http';

interface ListProductsParams {
  search?: string;
  inStock?: boolean;
}

export function listProducts(params: ListProductsParams = {}): Promise<Product[]> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.inStock) query.set('inStock', 'true');
  const queryString = query.toString();
  return request<Product[]>(`/products${queryString ? `?${queryString}` : ''}`);
}

export function createProduct(input: ProductInput): Promise<Product> {
  return request<Product>('/products', { method: 'POST', body: input });
}

export function updateProduct(id: string, input: ProductUpdateInput): Promise<Product> {
  return request<Product>(`/products/${id}`, { method: 'PATCH', body: input });
}

export function setProductStatus(id: string, isActive: boolean): Promise<Product> {
  return request<Product>(`/products/${id}/status`, { method: 'PATCH', body: { isActive } });
}

export function deleteProduct(id: string): Promise<void> {
  return request<void>(`/products/${id}`, { method: 'DELETE' });
}
