// Shapes returned by the API. Keep in sync with server/src/types/dto.ts.

export interface Product {
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

export interface Receiver {
  id: string;
  name: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PurchaseOrderStatus = 'OPEN' | 'PARTIALLY_RECEIVED' | 'COMPLETED' | 'CANCELLED';

export interface PurchaseOrderItem {
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

export interface GoodsReceiptItem {
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

export interface GoodsReceipt {
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
  reversalReason?: string | null;
  reversedBy?: string | null;
  reversedAt?: string | null;
  createdAt: string;
  items: GoodsReceiptItem[];
}

export interface GoodsReceiptItemInput {
  productId: string;
  goodQty: number;
  goodBaseQty?: number;
  bonusQty?: number;
  bonusBaseQty?: number;
  rejectedQty?: number;
  rejectedBaseQty?: number;
  rejectedReason?: string;
  unitCostPerPurchaseUnit?: number;
}

export interface CreateGoodsReceiptInput {
  purchaseOrderId?: string;
  receiverId: string;
  receivedAt?: string;
  idempotencyKey: string;
  note?: string;
  items: GoodsReceiptItemInput[];
}

export interface ReverseGoodsReceiptInput {
  reason: string;
  person: string;
}

export interface RejectedClaimItem {
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

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  status: PurchaseOrderStatus;
  orderDate: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  items?: PurchaseOrderItem[];
  receipts?: GoodsReceipt[];
}

export interface PurchaseOrderInput {
  supplierId: string;
  orderDate: string; // ISO date
  note?: string;
  items: Array<{
    productId: string;
    orderedQty: number; // in PURCHASE units
  }>;
}

export interface ProductInput {
  sku: string;
  name: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
}

export type ProductUpdateInput = Partial<Omit<ProductInput, 'stock'>>;

export interface SaleSummary {
  id: string;
  invoiceNumber: string;
  total: number;
  itemCount: number;
  createdAt: string;
}

export interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  productIsActive: boolean;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface SaleDetail {
  id: string;
  invoiceNumber: string;
  total: number;
  createdAt: string;
  items: SaleItem[];
}

export interface SaleRequestItem {
  productId: string;
  quantity: number;
}

export type StockMovementType = 'INITIAL' | 'SALE' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'PROCUREMENT_IN' | 'PROCUREMENT_REJECT';

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  productIsActive: boolean;
  type: StockMovementType;
  quantity: number;
  beforeStock: number;
  afterStock: number;
  referenceType: string | null;
  referenceId: string | null;
  referenceLabel: string | null;
  note: string | null;
  createdAt: string;
}

export interface StockAdjustmentInput {
  productId: string;
  newQty?: number;
  oldQty?: number;
  type?: 'IN' | 'OUT';
  quantity?: number;
  person: string;
  reason: string;
  note?: string;
}

export interface Dashboard {
  totalProducts: number;
  totalUnits: number;
  todaySalesTotal: number;
  lowStockCount: number;
  lowStockThreshold: number;
  latestSales: SaleSummary[];
  lowStockProducts: Product[];
}
