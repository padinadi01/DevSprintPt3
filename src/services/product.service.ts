import { Prisma, StockMovementType, type Product } from '@prisma/client';
import {
  PRODUCT_HAS_STOCK_HISTORY_MESSAGE,
  PRODUCT_IN_TRANSACTION_MESSAGE,
} from '../lib/constants';
import { db } from '../lib/db';
import { cache } from '../lib/cache';
import { ConflictError, NotFoundError } from '../lib/errors';
import { hasPrismaCode } from '../lib/prisma-errors';
import type { ProductDto } from '../types/dto';
import type {
  CreateProductInput,
  ListProductsFilter,
  UpdateProductInput,
  UpdateProductStatusInput,
} from '../validators/product.validator';

const PRODUCT_NOT_FOUND = 'Produk tidak ditemukan.';
const SKU_ALREADY_USED = 'SKU sudah digunakan oleh produk lain.';

export function formatStockBreakdown(
  stock: number,
  unitsPerPurchase: number,
  unitOfPurchase: string,
  baseUnit: string,
): string {
  if (unitsPerPurchase <= 1) {
    return `${stock} ${baseUnit}`;
  }
  const purchaseUnits = Math.floor(stock / unitsPerPurchase);
  const looseUnits = stock % unitsPerPurchase;
  if (purchaseUnits === 0) {
    return `${stock} ${baseUnit}`;
  }
  if (looseUnits === 0) {
    return `${stock} ${baseUnit} = ${purchaseUnits} ${unitOfPurchase}`;
  }
  return `${stock} ${baseUnit} = ${purchaseUnits} ${unitOfPurchase} + ${looseUnits} ${baseUnit}`;
}

export function toProductDto(product: Product): ProductDto {
  const toNum = (val: any) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    if (typeof val.toNumber === 'function') return val.toNumber();
    const n = Number(val);
    return isNaN(n) ? 0 : n;
  };

  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    category: product.category,
    purchasePrice: toNum(product.purchasePrice),
    sellingPrice: toNum(product.sellingPrice),
    stock: product.stock,
    isActive: product.isActive,
    unitOfPurchase: product.unitOfPurchase,
    unitsPerPurchase: product.unitsPerPurchase,
    baseUnit: product.baseUnit,
    stockBreakdown: formatStockBreakdown(
      product.stock,
      product.unitsPerPurchase,
      product.unitOfPurchase,
      product.baseUnit,
    ),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

export async function listProducts(filter: Partial<ListProductsFilter> = {}): Promise<ProductDto[]> {
  const isCacheable = !filter.search;
  const cacheKey = isCacheable ? (filter.inStock ? 'products:inStock' : 'products:all') : null;

  if (cacheKey) {
    const cached = cache.get<ProductDto[]>(cacheKey);
    if (cached) return cached;
  }

  const where: Prisma.ProductWhereInput = {};

  if (filter.search) {
    where.OR = [
      { name: { contains: filter.search, mode: 'insensitive' } },
      { sku: { contains: filter.search, mode: 'insensitive' } },
      { category: { contains: filter.search, mode: 'insensitive' } },
    ];
  }
  if (filter.inStock) {
    where.stock = { gt: 0 };
    where.isActive = true;
  }

  const products = await db.product.findMany({ where, orderBy: { name: 'asc' } });
  const result = products.map(toProductDto);

  if (cacheKey) {
    cache.set(cacheKey, result, 15000);
  }

  return result;
}

export async function getProduct(id: string): Promise<ProductDto> {
  const product = await db.product.findUnique({ where: { id } });
  if (!product) throw new NotFoundError(PRODUCT_NOT_FOUND);
  return toProductDto(product);
}

export async function createProduct(input: CreateProductInput): Promise<ProductDto> {
  try {
    const product = await db.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          sku: input.sku,
          name: input.name,
          category: input.category,
          purchasePrice: input.purchasePrice,
          sellingPrice: input.sellingPrice,
          stock: input.stock,
        },
      });

      // Every unit of stock must be explainable by the stock history, including the first ones.
      if (created.stock > 0) {
        await tx.stockMovement.create({
          data: {
            productId: created.id,
            type: StockMovementType.INITIAL,
            quantity: created.stock,
            beforeStock: 0,
            afterStock: created.stock,
            note: 'Stok awal',
          },
        });
      }

      return created;
    });

    cache.invalidate('products');
    cache.invalidate('dashboard');
    return toProductDto(product);
  } catch (error) {
    if (hasPrismaCode(error, 'P2002')) throw new ConflictError(SKU_ALREADY_USED);
    throw error;
  }
}

export async function updateProduct(id: string, input: UpdateProductInput): Promise<ProductDto> {
  try {
    const product = await db.product.update({ where: { id }, data: input });
    cache.invalidate('products');
    cache.invalidate('dashboard');
    return toProductDto(product);
  } catch (error) {
    if (hasPrismaCode(error, 'P2025')) throw new NotFoundError(PRODUCT_NOT_FOUND);
    if (hasPrismaCode(error, 'P2002')) throw new ConflictError(SKU_ALREADY_USED);
    throw error;
  }
}

export async function setProductStatus(
  id: string,
  input: UpdateProductStatusInput,
): Promise<ProductDto> {
  try {
    const product = await db.product.update({
      where: { id },
      data: { isActive: input.isActive },
    });
    cache.invalidate('products');
    cache.invalidate('dashboard');
    return toProductDto(product);
  } catch (error) {
    if (hasPrismaCode(error, 'P2025')) throw new NotFoundError(PRODUCT_NOT_FOUND);
    throw error;
  }
}

export async function deleteProduct(id: string): Promise<void> {
  const product = await db.product.findUnique({ where: { id }, select: { id: true } });
  if (!product) throw new NotFoundError(PRODUCT_NOT_FOUND);

  const saleItemCount = await db.saleItem.count({ where: { productId: id } });
  if (saleItemCount > 0) throw new ConflictError(PRODUCT_IN_TRANSACTION_MESSAGE);

  const otherMovementCount = await db.stockMovement.count({
    where: { productId: id, type: { not: StockMovementType.INITIAL } },
  });
  if (otherMovementCount > 0) throw new ConflictError(PRODUCT_HAS_STOCK_HISTORY_MESSAGE);

  try {
    await db.$transaction([
      db.stockMovement.deleteMany({ where: { productId: id, type: StockMovementType.INITIAL } }),
      db.product.delete({ where: { id } }),
    ]);
    cache.invalidate('products');
    cache.invalidate('dashboard');
  } catch (error) {
    // Someone referenced the product between the checks above and the delete.
    if (hasPrismaCode(error, 'P2003')) throw new ConflictError(PRODUCT_IN_TRANSACTION_MESSAGE);
    if (hasPrismaCode(error, 'P2025')) throw new NotFoundError(PRODUCT_NOT_FOUND);
    throw error;
  }
}
