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
  createdAt: string;
  updatedAt: string;
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

export type StockMovementTypeDto =
  | 'INITIAL'
  | 'SALE'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'RESTOCK'
  | 'RESTOCK_BONUS'
  | 'DAMAGED_IN'
  | 'OPNAME_IN'
  | 'OPNAME_OUT';

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


// --- RESTOCK MODULE ---

export interface SupplierDto {
  id: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RestockOrderItemDto {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitName: string;
  piecesPerUnit: number;
  purchasePrice: number;
  status: string;
}

export interface RestockReceiptItemDto {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantityGood: number;
  quantityDamaged: number;
  quantityBonus: number;
  purchasePrice: number;
  unitName: string;
  piecesPerUnit: number;
  notes: string | null;
}

export interface RestockReceiptDto {
  id: string;
  receiptNumber: string;
  receivedBy: string;
  notes: string | null;
  receivedAt: string;
  items: RestockReceiptItemDto[];
}

export interface RestockOrderSummaryDto {
  id: string;
  orderNumber: string;
  supplierName: string;
  status: string;
  itemCount: number;
  orderedAt: string;
}

export interface RestockOrderDetailDto {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  status: string;
  notes: string | null;
  orderedAt: string;
  items: RestockOrderItemDto[];
  receipts: RestockReceiptDto[];
}

// --- INVENTORY MODULE ---

export interface InventoryCheckItemDto {
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

export interface InventoryCheckSummaryDto {
  id: string;
  checkNumber: string;
  checkedBy: string;
  status: string;
  itemCount: number;
  totalDifference: number;
  checkedAt: string;
}

export interface InventoryCheckDetailDto {
  id: string;
  checkNumber: string;
  checkedBy: string;
  status: string;
  notes: string | null;
  checkedAt: string;
  items: InventoryCheckItemDto[];
}
