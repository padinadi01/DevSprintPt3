// Shapes returned by the API. Keep in sync with server/src/types/dto.ts.

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  purchasePrice?: number;
  sellingPrice: number;
  stock: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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

export type StockMovementType = 'INITIAL' | 'SALE' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'RESTOCK' | 'RESTOCK_BONUS' | 'DAMAGED_IN' | 'OPNAME_IN' | 'OPNAME_OUT';

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
  type: 'IN' | 'OUT';
  quantity: number;
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

// --- RESTOCK MODULE ---

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierInput {
  name: string;
  phone?: string;
}

export interface RestockOrderItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitName: string;
  piecesPerUnit: number;
  purchasePrice?: number;
  status: string;
}

export interface RestockReceiptItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantityGood: number;
  quantityDamaged: number;
  quantityBonus: number;
  purchasePrice?: number;
  unitName: string;
  piecesPerUnit: number;
  notes: string | null;
}

export interface RestockReceipt {
  id: string;
  receiptNumber: string;
  receivedBy: string;
  notes: string | null;
  receivedAt: string;
  items: RestockReceiptItem[];
}

export interface RestockOrderSummary {
  id: string;
  orderNumber: string;
  supplierName: string;
  status: string;
  itemCount: number;
  orderedAt: string;
}

export interface RestockOrderDetail {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  status: string;
  notes: string | null;
  orderedAt: string;
  items: RestockOrderItem[];
  receipts: RestockReceipt[];
}

export interface RestockOrderInput {
  supplierId: string;
  notes?: string;
  items: {
    productId: string;
    quantityOrdered: number;
    unitName: string;
    piecesPerUnit: number;
    purchasePrice: number;
  }[];
}

export interface RestockReceiptInput {
  idempotencyKey: string;
  notes?: string;
  items: {
    restockOrderItemId: string;
    quantityGood: number;
    quantityDamaged?: number;
    quantityBonus?: number;
    notes?: string;
  }[];
}

// --- INVENTORY MODULE ---

export interface InventoryCheckItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  systemStock: number;
  physicalStock: number;
  difference: number;
  reason: string;
  notes: string | null;
}

export interface InventoryCheckSummary {
  id: string;
  checkNumber: string;
  checkedBy: string;
  status: string;
  itemCount: number;
  totalDifference: number;
  checkedAt: string;
}

export interface InventoryCheckDetail {
  id: string;
  checkNumber: string;
  checkedBy: string;
  status: string;
  notes: string | null;
  checkedAt: string;
  items: InventoryCheckItem[];
}

export interface InventoryCheckInput {
  notes?: string;
  items: {
    productId: string;
    physicalStock: number;
    reason: string;
    notes?: string;
  }[];
}
