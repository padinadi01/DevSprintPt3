"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPurchaseOrders = listPurchaseOrders;
exports.getPurchaseOrder = getPurchaseOrder;
exports.createPurchaseOrder = createPurchaseOrder;
exports.cancelPurchaseOrder = cancelPurchaseOrder;
const db_1 = require("../lib/db");
const errors_1 = require("../lib/errors");
const PO_NOT_FOUND = 'Purchase Order tidak ditemukan.';
const SUPPLIER_NOT_FOUND = 'Supplier tidak ditemukan.';
const poInclude = {
    supplier: { select: { name: true } },
};
const poDetailInclude = {
    supplier: { select: { name: true } },
    items: {
        include: {
            product: { select: { sku: true, name: true, unitOfPurchase: true, unitsPerPurchase: true } },
        },
    },
    receipts: {
        include: {
            receiver: { select: { name: true } },
            supplier: { select: { name: true } },
            items: {
                include: {
                    product: { select: { sku: true, name: true, unitOfPurchase: true, unitsPerPurchase: true } },
                },
            },
        },
        orderBy: { receivedAt: 'desc' },
    },
};
function toPurchaseOrderDto(po) {
    const isDetail = 'items' in po;
    const receipts = isDetail && 'receipts' in po && Array.isArray(po.receipts) ? po.receipts : [];
    const formatDate = (d) => {
        if (!d)
            return new Date().toISOString();
        return typeof d === 'string' ? d : (d instanceof Date ? d.toISOString() : new Date(d).toISOString());
    };
    return {
        id: po.id,
        supplierId: po.supplierId,
        supplierName: po.supplier?.name || 'Supplier',
        status: po.status,
        orderDate: formatDate(po.orderDate),
        note: po.note || po.notes || null,
        createdAt: formatDate(po.createdAt),
        updatedAt: formatDate(po.updatedAt),
        items: isDetail && Array.isArray(po.items)
            ? po.items.map((item) => {
                const unitsPerPurchase = item.product?.unitsPerPurchase || 1;
                const orderedQty = item.orderedQty ?? item.quantity ?? 0;
                const orderedBaseUnits = orderedQty * unitsPerPurchase;
                const receivedGoodBaseUnits = receipts
                    .filter((r) => r.status === 'RECEIVED')
                    .flatMap((r) => r.items || [])
                    .filter((i) => i.productId === item.productId && !i.isBonus)
                    .reduce((sum, i) => sum +
                    ((i.receivedQty || 0) - (i.rejectedQty || 0)) * unitsPerPurchase +
                    (i.receivedBaseQty || 0) -
                    (i.rejectedBaseQty || 0), 0);
                const remainingBaseUnits = Math.max(0, orderedBaseUnits - receivedGoodBaseUnits);
                const receivedQty = Math.floor(receivedGoodBaseUnits / unitsPerPurchase);
                const remainingQty = Math.ceil(remainingBaseUnits / unitsPerPurchase);
                return {
                    id: item.id,
                    productId: item.productId,
                    productName: item.product?.name || 'Produk',
                    productSku: item.product?.sku || '-',
                    unitOfPurchase: item.product?.unitOfPurchase || 'pcs',
                    unitsPerPurchase,
                    orderedQty,
                    receivedQty,
                    remainingQty,
                };
            })
            : undefined,
        receipts: isDetail
            ? receipts.map((r) => ({
                id: r.id,
                purchaseOrderId: r.purchaseOrderId,
                supplierId: r.supplierId,
                supplierName: r.supplier?.name || po.supplier?.name || 'Supplier',
                receiverId: r.receiverId,
                receiverName: r.receiver?.name || 'Penerima',
                status: r.status,
                receivedAt: formatDate(r.receivedAt),
                idempotencyKey: r.idempotencyKey,
                note: r.note,
                reversalReason: r.reversalReason,
                reversedBy: r.reversedBy,
                reversedAt: r.reversedAt ? formatDate(r.reversedAt) : null,
                createdAt: formatDate(r.createdAt),
                items: (r.items || []).map((i) => ({
                    id: i.id,
                    productId: i.productId,
                    productName: i.product?.name || 'Produk',
                    productSku: i.product?.sku || '-',
                    unitOfPurchase: i.product?.unitOfPurchase || 'pcs',
                    unitsPerPurchase: i.product?.unitsPerPurchase || 1,
                    receivedQty: i.receivedQty || 0,
                    receivedBaseQty: i.receivedBaseQty || 0,
                    rejectedQty: i.rejectedQty || 0,
                    rejectedBaseQty: i.rejectedBaseQty || 0,
                    rejectedReason: i.rejectedReason || null,
                    isBonus: !!i.isBonus,
                    unitCostPerPurchaseUnit: i.unitCostPerPurchaseUnit ? (typeof i.unitCostPerPurchaseUnit.toNumber === 'function' ? i.unitCostPerPurchaseUnit.toNumber() : Number(i.unitCostPerPurchaseUnit)) : 0,
                    unitCostPerBaseUnit: i.unitCostPerBaseUnit ? (typeof i.unitCostPerBaseUnit.toNumber === 'function' ? i.unitCostPerBaseUnit.toNumber() : Number(i.unitCostPerBaseUnit)) : 0,
                    createdAt: formatDate(i.createdAt),
                })),
            }))
            : undefined,
    };
}
async function listPurchaseOrders() {
    const pos = await db_1.db.purchaseOrder.findMany({
        orderBy: { orderDate: 'desc' },
        include: poInclude,
    });
    return pos.map(toPurchaseOrderDto);
}
async function getPurchaseOrder(id) {
    const po = await db_1.db.purchaseOrder.findUnique({
        where: { id },
        include: poDetailInclude,
    });
    if (!po)
        throw new errors_1.NotFoundError(PO_NOT_FOUND);
    return toPurchaseOrderDto(po);
}
async function createPurchaseOrder(input) {
    // Validate supplier
    const supplier = await db_1.db.supplier.findUnique({ where: { id: input.supplierId } });
    if (!supplier)
        throw new errors_1.NotFoundError(SUPPLIER_NOT_FOUND);
    // Validate all products exist and are active
    const productIds = input.items.map(item => item.productId);
    const products = await db_1.db.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, isActive: true, name: true },
    });
    const productMap = new Map(products.map(p => [p.id, p]));
    for (const item of input.items) {
        const product = productMap.get(item.productId);
        if (!product)
            throw new errors_1.NotFoundError(`Produk dengan ID ${item.productId} tidak ditemukan.`);
        if (!product.isActive) {
            throw new errors_1.ConflictError(`Produk ${product.name} tidak aktif dan tidak bisa dipesan.`);
        }
    }
    // Create PO (Stock does NOT change on creation)
    const po = await db_1.db.purchaseOrder.create({
        data: {
            supplierId: input.supplierId,
            orderDate: new Date(input.orderDate),
            note: input.note,
            status: 'OPEN',
            items: {
                create: input.items.map(item => ({
                    productId: item.productId,
                    orderedQty: item.orderedQty,
                })),
            },
        },
        include: poDetailInclude,
    });
    return toPurchaseOrderDto(po);
}
async function cancelPurchaseOrder(id, note) {
    const po = await db_1.db.purchaseOrder.findUnique({
        where: { id },
        include: poDetailInclude,
    });
    if (!po)
        throw new errors_1.NotFoundError(PO_NOT_FOUND);
    if (po.status === 'COMPLETED') {
        throw new errors_1.ConflictError('Purchase Order yang sudah selesai tidak dapat dibatalkan.');
    }
    if (po.status === 'CANCELLED') {
        throw new errors_1.ConflictError('Purchase Order sudah dalam status dibatalkan.');
    }
    // Cancelling must NOT touch stock already received.
    // We only change the status to CANCELLED so no further receipts can be made against this PO.
    const updatedNote = note
        ? po.note
            ? `${po.note} (Dibatalkan: ${note})`
            : `Dibatalkan: ${note}`
        : po.note;
    const updatedPo = await db_1.db.purchaseOrder.update({
        where: { id },
        data: {
            status: 'CANCELLED',
            note: updatedNote,
        },
        include: poDetailInclude,
    });
    return toPurchaseOrderDto(updatedPo);
}
