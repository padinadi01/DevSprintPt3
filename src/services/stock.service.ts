import { Prisma, StockMovementType } from '@prisma/client';
import { PRODUCT_INACTIVE_STOCK_MESSAGE } from '../lib/constants';
import { db } from '../lib/db';
import { ConflictError, NotFoundError } from '../lib/errors';
import type { StockMovementDto } from '../types/dto';
import type {
  ListStockMovementsFilter,
  StockAdjustmentInput,
} from '../validators/stock.validator';

const MAX_MOVEMENTS_IN_LIST = 300;

const movementInclude = {
  product: { select: { name: true, sku: true, isActive: true } },
} satisfies Prisma.StockMovementInclude;

type MovementWithProduct = Prisma.StockMovementGetPayload<{ include: typeof movementInclude }>;

function toStockMovementDto(
  movement: MovementWithProduct,
  referenceLabel: string | null,
): StockMovementDto {
  return {
    id: movement.id,
    productId: movement.productId,
    productName: movement.product.name,
    productSku: movement.product.sku,
    productIsActive: movement.product.isActive,
    type: movement.type,
    quantity: movement.quantity,
    beforeStock: movement.beforeStock,
    afterStock: movement.afterStock,
    referenceType: movement.referenceType,
    referenceId: movement.referenceId,
    referenceLabel,
    note: movement.note,
    createdAt: movement.createdAt.toISOString(),
  };
}

// Manual stock adjustment / physical count (Stock Opname).
// Product stock and its StockMovement change in one transaction. No silent overwrites.
export async function adjustStock(input: StockAdjustmentInput): Promise<StockMovementDto> {
  return db.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: input.productId } });
    if (!product) throw new NotFoundError('Produk tidak ditemukan.');
    if (!product.isActive) throw new ConflictError(PRODUCT_INACTIVE_STOCK_MESSAGE);

    if (!input.reason || input.reason.trim().length === 0) {
      throw new ConflictError('Alasan penyesuaian stok wajib diisi.');
    }

    const beforeStock = product.stock;
    let afterStock: number;
    let movementType: StockMovementType;
    let movementQty: number;

    if (input.newQty !== undefined) {
      // Physical count (Stock Opname) mode
      if (input.newQty < 0) {
        throw new ConflictError('Penyesuaian stok ditolak: stok tidak boleh negatif.');
      }

      if (input.oldQty !== undefined && input.oldQty !== beforeStock) {
        throw new ConflictError(
          `Stok produk di sistem (${beforeStock}) berbeda dengan stok lama saat dihitung (${input.oldQty}). Silakan refresh dan periksa kembali.`,
        );
      }

      const diff = input.newQty - beforeStock;
      if (diff === 0) {
        throw new ConflictError(
          `Jumlah stok baru (${input.newQty}) sama dengan stok saat ini, tidak ada selisih stok.`,
        );
      }

      if (diff > 0) {
        movementType = StockMovementType.ADJUSTMENT_IN;
        movementQty = diff;
      } else {
        movementType = StockMovementType.ADJUSTMENT_OUT;
        movementQty = Math.abs(diff);
      }
      afterStock = input.newQty;

      await tx.product.update({
        where: { id: product.id },
        data: { stock: afterStock },
      });
    } else {
      // Delta mode (IN / OUT)
      let rawQty = input.quantity ?? 0;
      let type = input.type ?? (rawQty < 0 ? 'OUT' : 'IN');
      if (rawQty < 0) {
        movementQty = Math.abs(rawQty);
        type = 'OUT';
      } else {
        movementQty = rawQty;
      }

      if (movementQty === 0) {
        throw new ConflictError('Jumlah penyesuaian harus lebih dari 0.');
      }

      if (type === 'OUT') {
        if (beforeStock < movementQty) {
          throw new ConflictError(
            `Penyesuaian stok ditolak: stok tidak boleh negatif. Stok ${product.name} tersedia ${beforeStock}, penyesuaian keluar sebesar ${movementQty}.`,
          );
        }
        afterStock = beforeStock - movementQty;
        movementType = StockMovementType.ADJUSTMENT_OUT;

        const { count } = await tx.product.updateMany({
          where: { id: product.id, stock: { gte: movementQty } },
          data: { stock: { decrement: movementQty } },
        });
        if (count === 0) {
          throw new ConflictError(
            `Stok ${product.name} berubah dan tidak lagi mencukupi. Silakan coba lagi.`,
          );
        }
      } else {
        afterStock = beforeStock + movementQty;
        movementType = StockMovementType.ADJUSTMENT_IN;

        await tx.product.update({
          where: { id: product.id },
          data: { stock: { increment: movementQty } },
        });
      }
    }

    // Ledger entry: StockMovement is always recorded (never silent overwrite)
    const noteText = `[Disesuaikan oleh: ${input.person}] Alasan: ${input.reason}${
      input.note ? ` | Catatan: ${input.note}` : ''
    }`;

    const movement = await tx.stockMovement.create({
      data: {
        productId: product.id,
        type: movementType,
        quantity: movementQty,
        beforeStock,
        afterStock,
        note: noteText,
      },
      include: movementInclude,
    });

    return toStockMovementDto(movement, null);
  });
}

export async function listStockMovements(
  filter: ListStockMovementsFilter,
): Promise<StockMovementDto[]> {
  const movements = await db.stockMovement.findMany({
    where: filter.productId ? { productId: filter.productId } : {},
    orderBy: { createdAt: 'desc' },
    take: MAX_MOVEMENTS_IN_LIST,
    include: movementInclude,
  });

  // Sale movements point to their sale through referenceType / referenceId; show the invoice number.
  const saleIds: string[] = [];
  for (const movement of movements) {
    if (movement.referenceType === 'SALE' && movement.referenceId) {
      saleIds.push(movement.referenceId);
    }
  }
  const sales =
    saleIds.length > 0
      ? await db.sale.findMany({
          where: { id: { in: saleIds } },
          select: { id: true, invoiceNumber: true },
        })
      : [];
  const invoiceBySaleId = new Map(sales.map((sale) => [sale.id, sale.invoiceNumber]));

  return movements.map((movement) =>
    toStockMovementDto(
      movement,
      movement.referenceId ? (invoiceBySaleId.get(movement.referenceId) ?? null) : null,
    ),
  );
}
