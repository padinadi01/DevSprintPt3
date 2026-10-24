import { Prisma } from '@prisma/client';
import { db } from '../lib/db';
import { ConflictError, NotFoundError } from '../lib/errors';
import type { PurchaseOrderDto } from '../types/dto';
import type { CreatePurchaseOrderInput } from '../validators/purchase-order.validator';

const PO_NOT_FOUND = 'Purchase Order tidak ditemukan.';
const SUPPLIER_NOT_FOUND = 'Supplier tidak ditemukan.';

const poInclude = {
  supplier: { select: { name: true } },
} satisfies Prisma.PurchaseOrderInclude;

type PoWithSupplier = Prisma.PurchaseOrderGetPayload<{ include: typeof poInclude }>;

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
} satisfies Prisma.PurchaseOrderInclude;

type PoWithDetail = Prisma.PurchaseOrderGetPayload<{ include: typeof poDetailInclude }>;

function toPurchaseOrderDto(po: PoWithSupplier | PoWithDetail): PurchaseOrderDto {
  const isDetail = 'items' in po;
  const receipts = isDetail && 'receipts' in po && Array.isArray((po as any).receipts) ? (po as any).receipts : [];

  const formatDate = (d: any) => {
    if (!d) return new Date().toISOString();
    return typeof d === 'string' ? d : (d instanceof Date ? d.toISOString() : new Date(d).toISOString());
  };

  return {
    id: po.id,
    supplierId: po.supplierId,
    supplierName: po.supplier?.name || 'Supplier',
    status: po.status,
    orderDate: formatDate((po as any).orderDate),
    note: po.note || (po as any).notes || null,
    createdAt: formatDate(po.createdAt),
    updatedAt: formatDate(po.updatedAt),
    items: isDetail && Array.isArray((po as any).items)
      ? (po as any).items.map((item: any) => {
          const unitsPerPurchase = item.product?.unitsPerPurchase || 1;
          const orderedQty = item.orderedQty ?? item.quantity ?? 0;
          const orderedBaseUnits = orderedQty * unitsPerPurchase;
          const receivedGoodBaseUnits = receipts
            .filter((r: any) => r.status === 'RECEIVED')
            .flatMap((r: any) => r.items || [])
            .filter((i: any) => i.productId === item.productId && !i.isBonus)
            .reduce(
              (sum: number, i: any) =>
                sum +
                ((i.receivedQty || 0) - (i.rejectedQty || 0)) * unitsPerPurchase +
                (i.receivedBaseQty || 0) -
                (i.rejectedBaseQty || 0),
              0,
            );

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
      ? receipts.map((r: any) => ({
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
          items: (r.items || []).map((i: any) => ({
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

export async function listPurchaseOrders(): Promise<PurchaseOrderDto[]> {
  const pos = await db.purchaseOrder.findMany({
    orderBy: { orderDate: 'desc' },
    include: poInclude,
  });
  return pos.map(toPurchaseOrderDto);
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrderDto> {
  const po = await db.purchaseOrder.findUnique({
    where: { id },
    include: poDetailInclude,
  });
  if (!po) throw new NotFoundError(PO_NOT_FOUND);
  return toPurchaseOrderDto(po);
}

export async function createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<PurchaseOrderDto> {
  // Validate supplier
  const supplier = await db.supplier.findUnique({ where: { id: input.supplierId } });
  if (!supplier) throw new NotFoundError(SUPPLIER_NOT_FOUND);

  // Validate all products exist and are active
  const productIds = input.items.map(item => item.productId);
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, isActive: true, name: true },
  });

  const productMap = new Map(products.map(p => [p.id, p]));
  for (const item of input.items) {
    const product = productMap.get(item.productId);
    if (!product) throw new NotFoundError(`Produk dengan ID ${item.productId} tidak ditemukan.`);
    if (!product.isActive) {
      throw new ConflictError(`Produk ${product.name} tidak aktif dan tidak bisa dipesan.`);
    }
  }

  // Create PO (Stock does NOT change on creation)
  const po = await db.purchaseOrder.create({
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

export async function cancelPurchaseOrder(id: string, note?: string): Promise<PurchaseOrderDto> {
  const po = await db.purchaseOrder.findUnique({
    where: { id },
    include: poDetailInclude,
  });
  if (!po) throw new NotFoundError(PO_NOT_FOUND);

  if (po.status === 'COMPLETED') {
    throw new ConflictError('Purchase Order yang sudah selesai tidak dapat dibatalkan.');
  }

  if (po.status === 'CANCELLED') {
    throw new ConflictError('Purchase Order sudah dalam status dibatalkan.');
  }

  // Cancelling must NOT touch stock already received.
  // We only change the status to CANCELLED so no further receipts can be made against this PO.
  const updatedNote = note
    ? po.note
      ? `${po.note} (Dibatalkan: ${note})`
      : `Dibatalkan: ${note}`
    : po.note;

  const updatedPo = await db.purchaseOrder.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      note: updatedNote,
    },
    include: poDetailInclude,
  });

  return toPurchaseOrderDto(updatedPo);
}
