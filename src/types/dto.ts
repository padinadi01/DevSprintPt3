// Shapes returned by the API. Money is sent as plain numbers (Rupiah), dates as ISO strings.
// The client keeps its own copy in client/src/types/api.ts, so change both when you change one.

export interface ProductDto {
  id: string;
  sku: string;
  name: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  isActive: boolean;
  unitOfPurchase: string;
  unitsPerPurchase: number;
  baseUnit: string;
  stockBreakdown?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReceiverDto {
  id: string;
  name: string;
}

export interface SupplierDto {
  id: string;
  name: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PurchaseOrderStatusDto = 'OPEN' | 'PARTIALLY_RECEIVED' | 'COMPLETED' | 'CANCELLED';

export interface PurchaseOrderItemDto {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  unitOfPurchase: string;
  unitsPerPurchase: number;
  orderedQty: number;
  receivedQty: number;
  remainingQty: number;
}

export interface GoodsReceiptItemDto {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  unitOfPurchase: string;
  unitsPerPurchase: number;
  receivedQty: number;
  receivedBaseQty: number;
  rejectedQty: number;
  rejectedBaseQty: number;
  rejectedReason: string | null;
  isBonus: boolean;
  unitCostPerPurchaseUnit: number;
  unitCostPerBaseUnit: number;
  createdAt: string;
}

export interface GoodsReceiptDto {
  id: string;
  purchaseOrderId: string | null;
  supplierId: string;
  supplierName: string;
  receiverId: string;
  receiverName: string;
  status: string;
  receivedAt: string;
  idempotencyKey: string;
  note: string | null;
  reversalReason: string | null;
  reversedBy: string | null;
  reversedAt: string | null;
  createdAt: string;
  items: GoodsReceiptItemDto[];
}

export interface RejectedClaimItemDto {
  receiptId: string;
  receivedAt: string;
  supplierId: string;
  supplierName: string;
  receiverId: string;
  receiverName: string;
  productId: string;
  productName: string;
  productSku: string;
  unitOfPurchase: string;
  baseUnit: string;
  unitsPerPurchase: number;
  rejectedPurchaseQty: number;
  rejectedBaseQty: number;
  totalRejectedBaseUnits: number;
  rejectedReason: string | null;
}

export interface PurchaseOrderDto {
  id: string;
  supplierId: string;
  supplierName: string;
  status: PurchaseOrderStatusDto;
  orderDate: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  items?: PurchaseOrderItemDto[];
  receipts?: GoodsReceiptDto[];
}

export interface SaleSummaryDto {
  id: string;
  invoiceNumber: string;
  total: number;
  itemCount: number;
  createdAt: string;
}

export interface SaleItemDto {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  productIsActive: boolean;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface SaleDetailDto {
  id: string;
  invoiceNumber: string;
  total: number;
  createdAt: string;
  items: SaleItemDto[];
}

export type StockMovementTypeDto = 'INITIAL' | 'SALE' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'PROCUREMENT_IN' | 'PROCUREMENT_REJECT';

export interface StockMovementDto {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  productIsActive: boolean;
  type: StockMovementTypeDto;
  quantity: number;
  beforeStock: number;
  afterStock: number;
  referenceType: string | null;
  referenceId: string | null;
  referenceLabel: string | null;
  note: string | null;
  createdAt: string;
}

export interface DashboardDto {
  totalProducts: number;
  totalUnits: number;
  todaySalesTotal: number;
  lowStockCount: number;
  lowStockThreshold: number;
  latestSales: SaleSummaryDto[];
  lowStockProducts: ProductDto[];
}
