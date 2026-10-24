"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listGoodsReceipts = listGoodsReceipts;
exports.getGoodsReceipt = getGoodsReceipt;
exports.listRejectedClaims = listRejectedClaims;
exports.createGoodsReceipt = createGoodsReceipt;
exports.reverseGoodsReceipt = reverseGoodsReceipt;
const client_1 = require("@prisma/client");
const db_1 = require("../lib/db");
const cache_1 = require("../lib/cache");
const errors_1 = require("../lib/errors");
const goodsReceiptInclude = {
    supplier: { select: { name: true } },
    receiver: { select: { name: true } },
    items: {
        include: {
            product: { select: { sku: true, name: true, unitOfPurchase: true, unitsPerPurchase: true, baseUnit: true } },
        },
        orderBy: { createdAt: 'asc' },
    },
};
function toGoodsReceiptDto(receipt) {
    return {
        id: receipt.id,
        purchaseOrderId: receipt.purchaseOrderId,
        supplierId: receipt.supplierId,
        supplierName: receipt.supplier.name,
        receiverId: receipt.receiverId,
        receiverName: receipt.receiver.name,
        status: receipt.status,
        receivedAt: receipt.receivedAt.toISOString(),
        idempotencyKey: receipt.idempotencyKey,
        note: receipt.note,
        reversalReason: receipt.reversalReason,
        reversedBy: receipt.reversedBy,
        reversedAt: receipt.reversedAt ? receipt.reversedAt.toISOString() : null,
        createdAt: receipt.createdAt.toISOString(),
        items: receipt.items.map((i) => ({
            id: i.id,
            productId: i.productId,
            productName: i.product.name,
            productSku: i.product.sku,
            unitOfPurchase: i.product.unitOfPurchase,
            unitsPerPurchase: i.product.unitsPerPurchase,
            receivedQty: i.receivedQty,
            receivedBaseQty: i.receivedBaseQty,
            rejectedQty: i.rejectedQty,
            rejectedBaseQty: i.rejectedBaseQty,
            rejectedReason: i.rejectedReason,
            isBonus: i.isBonus,
            unitCostPerPurchaseUnit: i.unitCostPerPurchaseUnit.toNumber(),
            unitCostPerBaseUnit: i.unitCostPerBaseUnit.toNumber(),
            createdAt: i.createdAt.toISOString(),
        })),
    };
}
async function listGoodsReceipts() {
    const receipts = await db_1.db.goodsReceipt.findMany({
        orderBy: { receivedAt: 'desc' },
        include: goodsReceiptInclude,
    });
    return receipts.map(toGoodsReceiptDto);
}
async function getGoodsReceipt(id) {
    const receipt = await db_1.db.goodsReceipt.findUnique({
        where: { id },
        include: goodsReceiptInclude,
    });
    if (!receipt)
        throw new errors_1.NotFoundError('Penerimaan barang tidak ditemukan.');
    return toGoodsReceiptDto(receipt);
}
async function listRejectedClaims(filter = {}) {
    const whereClause = {
        receipt: {
            status: 'RECEIVED',
            ...(filter.supplierId ? { supplierId: filter.supplierId } : {}),
            ...(filter.startDate || filter.endDate
                ? {
                    receivedAt: {
                        ...(filter.startDate ? { gte: new Date(filter.startDate) } : {}),
                        ...(filter.endDate ? { lte: new Date(filter.endDate) } : {}),
                    },
                }
                : {}),
        },
        OR: [{ rejectedQty: { gt: 0 } }, { rejectedBaseQty: { gt: 0 } }],
    };
    const items = await db_1.db.goodsReceiptItem.findMany({
        where: whereClause,
        include: {
            product: { select: { sku: true, name: true, unitOfPurchase: true, unitsPerPurchase: true, baseUnit: true } },
            receipt: {
                include: {
                    supplier: { select: { name: true } },
                    receiver: { select: { name: true } },
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    });
    return items.map((i) => ({
        receiptId: i.receiptId,
        receivedAt: i.receipt.receivedAt.toISOString(),
        supplierId: i.receipt.supplierId,
        supplierName: i.receipt.supplier.name,
        receiverId: i.receipt.receiverId,
        receiverName: i.receipt.receiver.name,
        productId: i.productId,
        productName: i.product.name,
        productSku: i.product.sku,
        unitOfPurchase: i.product.unitOfPurchase,
        baseUnit: i.product.baseUnit,
        unitsPerPurchase: i.product.unitsPerPurchase,
        rejectedPurchaseQty: i.rejectedQty,
        rejectedBaseQty: i.rejectedBaseQty,
        totalRejectedBaseUnits: i.rejectedQty * i.product.unitsPerPurchase + i.rejectedBaseQty,
        rejectedReason: i.rejectedReason,
    }));
}
async function createGoodsReceipt(input) {
    // 1. Idempotency Check: if key already exists, return existing receipt without duplicate stock movement
    const existing = await db_1.db.goodsReceipt.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: goodsReceiptInclude,
    });
    if (existing) {
        return toGoodsReceiptDto(existing);
    }
    // 2. Validate Receiver: Receiver is required (e.g. Udin or Sari)
    const receiver = await db_1.db.receiver.findUnique({ where: { id: input.receiverId } });
    if (!receiver) {
        throw new errors_1.NotFoundError('Penerima tidak ditemukan. Silakan pilih penerima yang valid (Udin atau Sari).');
    }
    // 3. Validate Purchase Order & Over-Receipt Guard (Point 1)
    let supplierId = input.supplierId;
    let po = null;
    if (input.purchaseOrderId) {
        po = await db_1.db.purchaseOrder.findUnique({
            where: { id: input.purchaseOrderId },
            include: { items: true },
        });
        if (!po)
            throw new errors_1.NotFoundError('Purchase Order tidak ditemukan.');
        if (po.status === 'CANCELLED')
            throw new errors_1.ConflictError('Purchase Order sudah dibatalkan.');
        if (po.status === 'COMPLETED')
            throw new errors_1.ConflictError('Purchase Order sudah selesai (COMPLETED). Tidak dapat menerima barang lagi.');
        supplierId = po.supplierId;
    }
    // 4. Validate all products exist (from input items and linked PO items)
    const productIds = new Set(input.items.map((i) => i.productId));
    if (po) {
        po.items.forEach((item) => productIds.add(item.productId));
    }
    const products = await db_1.db.product.findMany({
        where: { id: { in: Array.from(productIds) } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));
    for (const item of input.items) {
        const bonus = item.bonusQty || 0;
        const bonusBase = item.bonusBaseQty || 0;
        const rejected = item.rejectedQty || 0;
        const rejectedBase = item.rejectedBaseQty || 0;
        let received;
        if (item.receivedQty !== undefined) {
            received = item.receivedQty;
            if (rejected > received) {
                throw new errors_1.ConflictError(`Jumlah ditolak (${rejected}) tidak boleh lebih besar dari jumlah diterima (${received}).`);
            }
        }
        else {
            const good = item.goodQty || 0;
            received = good + rejected;
        }
        let receivedBase;
        if (item.receivedBaseQty !== undefined) {
            receivedBase = item.receivedBaseQty;
            if (item.receivedQty === undefined && rejectedBase > receivedBase) {
                throw new errors_1.ConflictError(`Jumlah ditolak satuan kecil (${rejectedBase}) tidak boleh lebih besar dari jumlah diterima satuan kecil (${receivedBase}).`);
            }
        }
        else {
            const goodBase = item.goodBaseQty || 0;
            receivedBase = goodBase + rejectedBase;
        }
        if (received < 0 || receivedBase < 0 || bonus < 0 || bonusBase < 0 || rejected < 0 || rejectedBase < 0) {
            throw new errors_1.ConflictError('Kuantitas penerimaan tidak boleh negatif.');
        }
        const p = productMap.get(item.productId);
        if (!p)
            throw new errors_1.NotFoundError(`Produk dengan ID ${item.productId} tidak ditemukan.`);
    }
    // 5. Over-receipt guard: Block receipt if good (paid) items exceed remaining on PO
    if (input.purchaseOrderId && po) {
        const activePoReceipts = await db_1.db.goodsReceipt.findMany({
            where: { purchaseOrderId: input.purchaseOrderId, status: 'RECEIVED' },
            include: { items: true },
        });
        for (const incomingItem of input.items) {
            const poItem = po.items.find((i) => i.productId === incomingItem.productId);
            if (!poItem) {
                throw new errors_1.ConflictError('Produk tidak ada dalam Purchase Order ini.');
            }
            const product = productMap.get(incomingItem.productId);
            const orderedBaseUnits = poItem.orderedQty * product.unitsPerPurchase;
            // Already accepted base units (excluding bonus, excluding rejected)
            const alreadyAcceptedBaseUnits = activePoReceipts
                .flatMap((r) => r.items)
                .filter((i) => i.productId === poItem.productId && !i.isBonus)
                .reduce((sum, i) => sum +
                (i.receivedQty - i.rejectedQty) * product.unitsPerPurchase +
                (i.receivedBaseQty || 0) -
                i.rejectedBaseQty, 0);
            const remainingBaseUnits = Math.max(0, orderedBaseUnits - alreadyAcceptedBaseUnits);
            // Incoming good units
            const incomingRejected = incomingItem.rejectedQty || 0;
            const incomingGoodPurchaseUnits = incomingItem.receivedQty !== undefined
                ? Math.max(0, incomingItem.receivedQty - incomingRejected)
                : (incomingItem.goodQty || 0);
            const incomingRejectedBase = incomingItem.rejectedBaseQty || 0;
            const incomingGoodLooseBaseUnits = Math.max(0, (incomingItem.receivedBaseQty ?? incomingItem.goodBaseQty ?? 0) - incomingRejectedBase);
            const incomingAcceptedBaseUnits = incomingGoodPurchaseUnits * product.unitsPerPurchase + incomingGoodLooseBaseUnits;
            if (incomingAcceptedBaseUnits > remainingBaseUnits) {
                const remainingPurchase = Math.floor(remainingBaseUnits / product.unitsPerPurchase);
                const remainingLoose = remainingBaseUnits % product.unitsPerPurchase;
                const remainingStr = remainingLoose > 0
                    ? `${remainingPurchase} ${product.unitOfPurchase} + ${remainingLoose} ${product.baseUnit}`
                    : `${remainingPurchase} ${product.unitOfPurchase}`;
                const incomingStr = incomingGoodLooseBaseUnits > 0
                    ? `${incomingGoodPurchaseUnits} ${product.unitOfPurchase} + ${incomingGoodLooseBaseUnits} ${product.baseUnit}`
                    : `${incomingGoodPurchaseUnits} ${product.unitOfPurchase}`;
                throw new errors_1.ConflictError(`Kuantitas penerimaan (${incomingStr}) melebihi sisa pesanan (${remainingStr}) untuk produk ${product.name}.`);
            }
        }
    }
    if (!supplierId) {
        throw new errors_1.ConflictError('Supplier wajib ditentukan untuk penerimaan barang.');
    }
    // 5. Execute all-or-nothing transaction
    const createdReceiptId = await db_1.db.$transaction(async (tx) => {
        // Re-check idempotency key inside transaction
        const raced = await tx.goodsReceipt.findUnique({
            where: { idempotencyKey: input.idempotencyKey },
        });
        if (raced)
            return raced.id;
        // Create header
        const receipt = await tx.goodsReceipt.create({
            data: {
                purchaseOrderId: input.purchaseOrderId,
                supplierId: supplierId,
                receiverId: input.receiverId,
                receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
                idempotencyKey: input.idempotencyKey,
                note: input.note,
                status: 'RECEIVED',
            },
        });
        for (const item of input.items) {
            const product = (await tx.product.findUnique({ where: { id: item.productId } }));
            const bonusQty = item.bonusQty || 0;
            const bonusBaseQty = item.bonusBaseQty || 0;
            const rejectedQty = item.rejectedQty || 0;
            const rejectedBaseQty = item.rejectedBaseQty || 0;
            let receivedQty;
            let goodPurchaseUnits;
            if (item.receivedQty !== undefined) {
                receivedQty = item.receivedQty;
                goodPurchaseUnits = Math.max(0, receivedQty - rejectedQty);
            }
            else {
                goodPurchaseUnits = item.goodQty || 0;
                receivedQty = goodPurchaseUnits + rejectedQty;
            }
            let receivedBaseQty;
            if (item.receivedBaseQty !== undefined) {
                receivedBaseQty = item.receivedBaseQty;
            }
            else {
                receivedBaseQty = item.goodBaseQty || 0;
            }
            const goodLooseUnits = Math.max(0, receivedBaseQty - rejectedBaseQty);
            // Units calculation in base units
            const totalGrossBaseUnits = receivedQty * product.unitsPerPurchase + receivedBaseQty;
            const totalRejectedBaseUnits = rejectedQty * product.unitsPerPurchase + rejectedBaseQty;
            const totalBonusBaseUnits = bonusQty * product.unitsPerPurchase + bonusBaseQty;
            // Net sellable stock added: stok_masuk = qty_diterima - qty_ditolak + qty_bonus
            const totalGoodBaseUnits = Math.max(0, totalGrossBaseUnits - totalRejectedBaseUnits);
            const netBaseUnitsToAdd = totalGoodBaseUnits + totalBonusBaseUnits;
            // Cost calculation (Point 5)
            let costPerPurchaseUnitInput;
            if (item.unitCostPerPurchaseUnit !== undefined) {
                costPerPurchaseUnitInput = new client_1.Prisma.Decimal(item.unitCostPerPurchaseUnit);
            }
            else {
                costPerPurchaseUnitInput = product.purchasePrice.times(product.unitsPerPurchase);
            }
            const standardBaseCost = costPerPurchaseUnitInput
                .dividedBy(product.unitsPerPurchase)
                .toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP);
            let spreadBaseCost;
            let spreadPurchaseCost;
            if (item.spreadBonusCost && totalBonusBaseUnits > 0 && totalGoodBaseUnits > 0) {
                // When bonus goods are present and spreadBonusCost is requested (e.g. Step 7C patch)
                const totalPaidCost = costPerPurchaseUnitInput
                    .times(goodPurchaseUnits)
                    .plus(standardBaseCost.times(goodLooseUnits));
                const totalEligibleUnits = totalGoodBaseUnits + totalBonusBaseUnits;
                spreadBaseCost = totalPaidCost
                    .dividedBy(totalEligibleUnits)
                    .toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP);
                spreadPurchaseCost = spreadBaseCost
                    .times(product.unitsPerPurchase)
                    .toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP);
            }
            else {
                // Standard (Chat Line 8 & DB constraint): Cost per base unit = price / pack size
                // Paid items keep their agreed cost; bonus item line records cost = 0
                spreadBaseCost = standardBaseCost;
                spreadPurchaseCost = costPerPurchaseUnitInput;
            }
            // Record standard items (good + rejected)
            if (receivedQty > 0 || receivedBaseQty > 0) {
                await tx.goodsReceiptItem.create({
                    data: {
                        receiptId: receipt.id,
                        productId: product.id,
                        receivedQty, // total diterima (gross)
                        receivedBaseQty,
                        rejectedQty,
                        rejectedBaseQty,
                        rejectedReason: (rejectedQty > 0 || rejectedBaseQty > 0) ? item.rejectedReason : null,
                        isBonus: false,
                        unitCostPerPurchaseUnit: spreadPurchaseCost,
                        unitCostPerBaseUnit: spreadBaseCost,
                    },
                });
            }
            // Record bonus items if any - bonus is free (cost = 0) per DB constraint and Chat line 8
            if (bonusQty > 0 || bonusBaseQty > 0) {
                await tx.goodsReceiptItem.create({
                    data: {
                        receiptId: receipt.id,
                        productId: product.id,
                        receivedQty: bonusQty,
                        receivedBaseQty: bonusBaseQty,
                        rejectedQty: 0,
                        rejectedBaseQty: 0,
                        rejectedReason: null,
                        isBonus: true,
                        unitCostPerPurchaseUnit: new client_1.Prisma.Decimal(0),
                        unitCostPerBaseUnit: new client_1.Prisma.Decimal(0),
                    },
                });
            }
            // Format catatan otomatis sesuai Poin 5:
            // "Penerimaan barang: diterima 2 pcs, ditolak 2 pcs, bonus 1 pcs → masuk 1 pcs"
            const unit = product.unitOfPurchase;
            let noteText;
            if (product.unitsPerPurchase === 1) {
                noteText = `Penerimaan barang: diterima ${receivedQty} ${unit}, ditolak ${rejectedQty} ${unit}, bonus ${bonusQty} ${unit} -> masuk ${netBaseUnitsToAdd} ${unit}`;
            }
            else {
                const loosePart = (receivedBaseQty > 0 || rejectedBaseQty > 0 || bonusBaseQty > 0)
                    ? ` (eceran: +${receivedBaseQty} -${rejectedBaseQty} +${bonusBaseQty} ${product.baseUnit})`
                    : '';
                noteText = `Penerimaan barang: diterima ${receivedQty} ${unit}, ditolak ${rejectedQty} ${unit}, bonus ${bonusQty} ${unit}${loosePart} -> masuk ${netBaseUnitsToAdd} ${product.baseUnit}`;
            }
            // Add to sellable stock (Poin 4: Satu sumber nilai netBaseUnitsToAdd)
            if (netBaseUnitsToAdd > 0) {
                const beforeStock = product.stock;
                const afterStock = beforeStock + netBaseUnitsToAdd;
                await tx.product.update({
                    where: { id: product.id },
                    data: { stock: afterStock },
                });
                await tx.stockMovement.create({
                    data: {
                        productId: product.id,
                        type: client_1.StockMovementType.PROCUREMENT_IN,
                        quantity: netBaseUnitsToAdd,
                        beforeStock,
                        afterStock,
                        referenceType: 'GOODS_RECEIPT',
                        referenceId: receipt.id,
                        note: noteText,
                    },
                });
            }
        }
        // 6. Update Purchase Order status if linked
        if (input.purchaseOrderId && po) {
            const allPoReceipts = await tx.goodsReceipt.findMany({
                where: { purchaseOrderId: input.purchaseOrderId, status: 'RECEIVED' },
                include: { items: true },
            });
            let allCompleted = true;
            let anyReceived = false;
            for (const poItem of po.items) {
                const product = productMap.get(poItem.productId);
                const orderedBaseUnits = poItem.orderedQty * product.unitsPerPurchase;
                const receivedGoodBaseUnits = allPoReceipts
                    .flatMap((r) => r.items)
                    .filter((i) => i.productId === poItem.productId && !i.isBonus)
                    .reduce((sum, i) => sum +
                    (i.receivedQty - i.rejectedQty) * product.unitsPerPurchase +
                    (i.receivedBaseQty || 0) -
                    i.rejectedBaseQty, 0);
                if (receivedGoodBaseUnits > 0)
                    anyReceived = true;
                if (receivedGoodBaseUnits < orderedBaseUnits)
                    allCompleted = false;
            }
            const nextStatus = input.completeOrder || allCompleted
                ? 'COMPLETED'
                : anyReceived
                    ? 'PARTIALLY_RECEIVED'
                    : 'OPEN';
            await tx.purchaseOrder.update({
                where: { id: input.purchaseOrderId },
                data: { status: nextStatus },
            });
        }
        return receipt.id;
    });
    cache_1.cache.invalidate('products');
    cache_1.cache.invalidate('dashboard');
    return getGoodsReceipt(createdReceiptId);
}
async function reverseGoodsReceipt(id, input) {
    const receipt = await db_1.db.goodsReceipt.findUnique({
        where: { id },
        include: goodsReceiptInclude,
    });
    if (!receipt) {
        throw new errors_1.NotFoundError('Penerimaan barang tidak ditemukan.');
    }
    if (receipt.status === 'CANCELLED') {
        throw new errors_1.ConflictError('Penerimaan barang ini sudah dibatalkan sebelumnya.');
    }
    // Pre-validate product stock availability
    const productDeductionMap = new Map();
    for (const item of receipt.items) {
        const product = await db_1.db.product.findUnique({ where: { id: item.productId } });
        if (!product) {
            throw new errors_1.NotFoundError(`Produk ${item.productId} tidak ditemukan.`);
        }
        const unitsAddedByItem = (item.receivedQty - item.rejectedQty) * product.unitsPerPurchase +
            item.receivedBaseQty -
            item.rejectedBaseQty;
        if (unitsAddedByItem > 0) {
            const curr = productDeductionMap.get(item.productId) || { product, unitsToDeduct: 0 };
            curr.unitsToDeduct += unitsAddedByItem;
            productDeductionMap.set(item.productId, curr);
        }
    }
    // Block reversal if current stock would go negative
    for (const [, { product, unitsToDeduct }] of productDeductionMap.entries()) {
        if (product.stock < unitsToDeduct) {
            throw new errors_1.ConflictError(`Tidak dapat membatalkan penerimaan: sisa stok ${product.name} (${product.stock} ${product.baseUnit}) tidak mencukupi untuk ditarik (${unitsToDeduct} ${product.baseUnit}).`);
        }
    }
    // Execute reversal inside transaction
    await db_1.db.$transaction(async (tx) => {
        for (const [productId, { unitsToDeduct }] of productDeductionMap.entries()) {
            const currentProduct = (await tx.product.findUnique({ where: { id: productId } }));
            if (currentProduct.stock < unitsToDeduct) {
                throw new errors_1.ConflictError(`Tidak dapat membatalkan penerimaan: sisa stok ${currentProduct.name} (${currentProduct.stock} ${currentProduct.baseUnit}) tidak mencukupi untuk ditarik (${unitsToDeduct} ${currentProduct.baseUnit}).`);
            }
            const beforeStock = currentProduct.stock;
            const afterStock = beforeStock - unitsToDeduct;
            await tx.product.update({
                where: { id: productId },
                data: { stock: afterStock },
            });
            await tx.stockMovement.create({
                data: {
                    productId,
                    type: client_1.StockMovementType.ADJUSTMENT_OUT,
                    quantity: unitsToDeduct,
                    beforeStock,
                    afterStock,
                    referenceType: 'GOODS_RECEIPT_REVERSAL',
                    referenceId: receipt.id,
                    note: `Pembatalan penerimaan #${receipt.id}: ditarik ${unitsToDeduct} ${currentProduct.baseUnit}. Petugas: ${input.person}. Alasan: ${input.reason}`,
                },
            });
        }
        const now = new Date();
        const updatedNote = receipt.note
            ? `${receipt.note} (Dibatalkan: ${input.reason} oleh ${input.person})`
            : `Dibatalkan: ${input.reason} oleh ${input.person}`;
        await tx.goodsReceipt.update({
            where: { id },
            data: {
                status: 'CANCELLED',
                reversalReason: input.reason,
                reversedBy: input.person,
                reversedAt: now,
                note: updatedNote,
            },
        });
        // Update PO status if linked
        if (receipt.purchaseOrderId) {
            const po = await tx.purchaseOrder.findUnique({
                where: { id: receipt.purchaseOrderId },
                include: { items: true },
            });
            if (po && po.status !== 'CANCELLED') {
                const remainingActiveReceipts = await tx.goodsReceipt.findMany({
                    where: { purchaseOrderId: receipt.purchaseOrderId, status: 'RECEIVED' },
                    include: { items: true },
                });
                let allCompleted = true;
                let anyReceived = false;
                for (const poItem of po.items) {
                    const product = (await tx.product.findUnique({ where: { id: poItem.productId } }));
                    const orderedBaseUnits = poItem.orderedQty * product.unitsPerPurchase;
                    const receivedGoodBaseUnits = remainingActiveReceipts
                        .flatMap((r) => r.items)
                        .filter((i) => i.productId === poItem.productId && !i.isBonus)
                        .reduce((sum, i) => sum +
                        (i.receivedQty - i.rejectedQty) * product.unitsPerPurchase +
                        (i.receivedBaseQty || 0) -
                        i.rejectedBaseQty, 0);
                    if (receivedGoodBaseUnits > 0)
                        anyReceived = true;
                    if (receivedGoodBaseUnits < orderedBaseUnits)
                        allCompleted = false;
                }
                const nextStatus = allCompleted && po.items.length > 0
                    ? 'COMPLETED'
                    : anyReceived
                        ? 'PARTIALLY_RECEIVED'
                        : 'OPEN';
                await tx.purchaseOrder.update({
                    where: { id: receipt.purchaseOrderId },
                    data: { status: nextStatus },
                });
            }
        }
    });
    cache_1.cache.invalidate('products');
    cache_1.cache.invalidate('dashboard');
    return getGoodsReceipt(id);
}
