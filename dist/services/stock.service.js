"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adjustStock = adjustStock;
exports.listStockMovements = listStockMovements;
const client_1 = require("@prisma/client");
const constants_1 = require("../lib/constants");
const db_1 = require("../lib/db");
const cache_1 = require("../lib/cache");
const errors_1 = require("../lib/errors");
const MAX_MOVEMENTS_IN_LIST = 300;
const movementInclude = {
    product: { select: { name: true, sku: true, isActive: true } },
};
function toStockMovementDto(movement, referenceLabel) {
    return {
        id: movement.id,
        productId: movement.productId,
        productName: movement.product?.name || 'Produk',
        productSku: movement.product?.sku || '-',
        productIsActive: movement.product ? movement.product.isActive : true,
        type: movement.type,
        quantity: movement.quantity,
        beforeStock: movement.beforeStock,
        afterStock: movement.afterStock,
        referenceType: movement.referenceType,
        referenceId: movement.referenceId,
        referenceLabel,
        note: movement.note,
        createdAt: typeof movement.createdAt === 'string' ? movement.createdAt : movement.createdAt.toISOString(),
    };
}
// Manual stock adjustment / physical count (Stock Opname).
// Product stock and its StockMovement change in one transaction. No silent overwrites.
async function adjustStock(input) {
    return db_1.db.$transaction(async (tx) => {
        const product = await tx.product.findUnique({ where: { id: input.productId } });
        if (!product)
            throw new errors_1.NotFoundError('Produk tidak ditemukan.');
        if (!product.isActive)
            throw new errors_1.ConflictError(constants_1.PRODUCT_INACTIVE_STOCK_MESSAGE);
        if (!input.reason || input.reason.trim().length === 0) {
            throw new errors_1.ConflictError('Alasan penyesuaian stok wajib diisi.');
        }
        const beforeStock = product.stock;
        let afterStock;
        let movementType;
        let movementQty;
        if (input.newQty !== undefined) {
            // Physical count (Stock Opname) mode
            if (input.newQty < 0) {
                throw new errors_1.ConflictError('Penyesuaian stok ditolak: stok tidak boleh negatif.');
            }
            if (input.oldQty !== undefined && input.oldQty !== beforeStock) {
                throw new errors_1.ConflictError(`Stok produk di sistem (${beforeStock}) berbeda dengan stok lama saat dihitung (${input.oldQty}). Silakan refresh dan periksa kembali.`);
            }
            const diff = input.newQty - beforeStock;
            if (diff === 0) {
                throw new errors_1.ConflictError(`Jumlah stok baru (${input.newQty}) sama dengan stok saat ini, tidak ada selisih stok.`);
            }
            if (diff > 0) {
                movementType = client_1.StockMovementType.ADJUSTMENT_IN;
                movementQty = diff;
            }
            else {
                movementType = client_1.StockMovementType.ADJUSTMENT_OUT;
                movementQty = Math.abs(diff);
            }
            afterStock = input.newQty;
            await tx.product.update({
                where: { id: product.id },
                data: { stock: afterStock },
            });
        }
        else {
            // Delta mode (IN / OUT)
            let rawQty = input.quantity ?? 0;
            let type = input.type ?? (rawQty < 0 ? 'OUT' : 'IN');
            if (rawQty < 0) {
                movementQty = Math.abs(rawQty);
                type = 'OUT';
            }
            else {
                movementQty = rawQty;
            }
            if (movementQty === 0) {
                throw new errors_1.ConflictError('Jumlah penyesuaian harus lebih dari 0.');
            }
            if (type === 'OUT') {
                if (beforeStock < movementQty) {
                    throw new errors_1.ConflictError(`Penyesuaian stok ditolak: stok tidak boleh negatif. Stok ${product.name} tersedia ${beforeStock}, penyesuaian keluar sebesar ${movementQty}.`);
                }
                afterStock = beforeStock - movementQty;
                movementType = client_1.StockMovementType.ADJUSTMENT_OUT;
                const { count } = await tx.product.updateMany({
                    where: { id: product.id, stock: { gte: movementQty } },
                    data: { stock: { decrement: movementQty } },
                });
                if (count === 0) {
                    throw new errors_1.ConflictError(`Stok ${product.name} berubah dan tidak lagi mencukupi. Silakan coba lagi.`);
                }
            }
            else {
                afterStock = beforeStock + movementQty;
                movementType = client_1.StockMovementType.ADJUSTMENT_IN;
                await tx.product.update({
                    where: { id: product.id },
                    data: { stock: { increment: movementQty } },
                });
            }
        }
        // Ledger entry: StockMovement is always recorded (never silent overwrite)
        const noteText = `[Disesuaikan oleh: ${input.person}] Alasan: ${input.reason}${input.note ? ` | Catatan: ${input.note}` : ''}`;
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
        const res = toStockMovementDto(movement, null);
        cache_1.cache.invalidate('products');
        cache_1.cache.invalidate('dashboard');
        return res;
    });
}
async function listStockMovements(filter) {
    const movements = await db_1.db.stockMovement.findMany({
        where: filter.productId ? { productId: filter.productId } : {},
        orderBy: { createdAt: 'desc' },
        take: MAX_MOVEMENTS_IN_LIST,
        include: movementInclude,
    });
    // Sale movements point to their sale through referenceType / referenceId; show the invoice number.
    const saleIds = [];
    for (const movement of movements) {
        if (movement.referenceType === 'SALE' && movement.referenceId) {
            saleIds.push(movement.referenceId);
        }
    }
    const sales = saleIds.length > 0
        ? await db_1.db.sale.findMany({
            where: { id: { in: saleIds } },
            select: { id: true, invoiceNumber: true },
        })
        : [];
    const invoiceBySaleId = new Map(sales.map((sale) => [sale.id, sale.invoiceNumber]));
    return movements.map((movement) => toStockMovementDto(movement, movement.referenceId ? (invoiceBySaleId.get(movement.referenceId) ?? null) : null));
}
