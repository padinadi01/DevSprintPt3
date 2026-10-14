import { mockStore, type InternalProduct } from '../lib/mock-store';
import type { ProductDto } from '../types/dto';
import type {
  CreateProductInput,
  ListProductsFilter,
  UpdateProductInput,
  UpdateProductStatusInput,
} from '../validators/product.validator';

export function toProductDto(product: InternalProduct): ProductDto {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    category: product.category,
    purchasePrice: product.purchasePrice,
    sellingPrice: product.sellingPrice,
    stock: product.stock,
    isActive: product.isActive,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export async function listProducts(filter: ListProductsFilter): Promise<ProductDto[]> {
  return mockStore.listProducts(filter);
}

export async function getProduct(id: string): Promise<ProductDto> {
  return mockStore.getProduct(id);
}

export async function createProduct(input: CreateProductInput): Promise<ProductDto> {
  return mockStore.createProduct(input);
}

export async function updateProduct(id: string, input: UpdateProductInput): Promise<ProductDto> {
  return mockStore.updateProduct(id, input);
}

export async function setProductStatus(
  id: string,
  input: UpdateProductStatusInput,
): Promise<ProductDto> {
  return mockStore.setProductStatus(id, input.isActive);
}

export async function deleteProduct(id: string): Promise<void> {
  mockStore.deleteProduct(id);
}
