import { Prisma, StockMovementType, type Product } from '@prisma/client';
import {
  PRODUCT_HAS_STOCK_HISTORY_MESSAGE,
  PRODUCT_IN_TRANSACTION_MESSAGE,
} from '../lib/constants';
import { db } from '../lib/db';
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
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    category: product.category,
    purchasePrice: product.purchasePrice.toNumber(),
    sellingPrice: product.sellingPrice.toNumber(),
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
  return products.map(toProductDto);
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

    return toProductDto(product);
  } catch (error) {
    if (hasPrismaCode(error, 'P2002')) throw new ConflictError(SKU_ALREADY_USED);
    throw error;
  }
}

export async function updateProduct(id: string, input: UpdateProductInput): Promise<ProductDto> {
  try {
    const product = await db.product.update({ where: { id }, data: input });
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
    return toProductDto(product);
  } catch (error) {
    if (hasPrismaCode(error, 'P2025')) throw new NotFoundError(PRODUCT_NOT_FOUND);
    throw error;
  }
}

// Hard delete. A product can only be removed while nothing but its own initial stock entry refers
// to it. The foreign keys in PostgreSQL (ON DELETE RESTRICT) are the final guard; the checks below
// exist to give the owner a clear message.
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
  } catch (error) {
    // Someone referenced the product between the checks above and the delete.
    if (hasPrismaCode(error, 'P2003')) throw new ConflictError(PRODUCT_IN_TRANSACTION_MESSAGE);
    if (hasPrismaCode(error, 'P2025')) throw new NotFoundError(PRODUCT_NOT_FOUND);
    throw error;
  }
}
