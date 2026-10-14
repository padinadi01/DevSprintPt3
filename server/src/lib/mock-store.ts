import { randomUUID } from 'crypto';
import type {
  ProductDto,
  SaleSummaryDto,
  SaleDetailDto,
  StockMovementDto,
  DashboardDto,
  SupplierDto,
  RestockOrderSummaryDto,
  RestockOrderDetailDto,
  RestockOrderItemDto,
  RestockReceiptDto,
  InventoryCheckSummaryDto,
  InventoryCheckDetailDto,
  InventoryCheckItemDto,
} from '../types/dto';
import { ConflictError, NotFoundError } from './errors';
import { LOW_STOCK_THRESHOLD } from './constants';

export interface InternalProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  isActive: boolean;
  unitName: string;
  bulkUnitName?: string;
  piecesPerBulk?: number;
  createdAt: string;
  updatedAt: string;
}

export interface InternalSupplier {
  id: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InternalRestockOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  status: 'PENDING' | 'PARTIAL' | 'COMPLETED' | 'CANCELLED';
  notes: string | null;
  orderedAt: string;
  items: RestockOrderItemDto[];
  receipts: RestockReceiptDto[];
}

export interface InternalInventoryCheck {
  id: string;
  checkNumber: string;
  checkedBy: string;
  status: 'DRAFT' | 'COMPLETED';
  notes: string | null;
  checkedAt: string;
  items: InventoryCheckItemDto[];
}

export interface InternalSale {
  id: string;
  invoiceNumber: string;
  total: number;
  createdAt: string;
  createdByUserId: string | null;
  items: {
    id: string;
    productId: string;
    productName: string;
    productSku: string;
    productIsActive: boolean;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[];
}

class MockDataStore {
  products: InternalProduct[] = [];
  suppliers: InternalSupplier[] = [];
  restockOrders: InternalRestockOrder[] = [];
  inventoryChecks: InternalInventoryCheck[] = [];
  sales: InternalSale[] = [];
  movements: StockMovementDto[] = [];
  usedIdempotencyKeys = new Set<string>();

  constructor() {
    this.seed();
  }

  seed() {
    const now = new Date();
    const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString();

    // 1. Seed Products
    this.products = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        sku: 'MIE-001',
        name: 'Indomie Goreng',
        category: 'Makanan Instan',
        purchasePrice: 2800,
        sellingPrice: 3500,
        stock: 60,
        isActive: true,
        unitName: 'bungkus',
        bulkUnitName: 'dus',
        piecesPerBulk: 40,
        createdAt: daysAgo(7),
        updatedAt: daysAgo(7),
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        sku: 'MNM-001',
        name: 'Aqua 600 ml',
        category: 'Minuman',
        purchasePrice: 2300,
        sellingPrice: 3000,
        stock: 48,
        isActive: true,
        unitName: 'botol',
        bulkUnitName: 'dus',
        piecesPerBulk: 24,
        createdAt: daysAgo(7),
        updatedAt: daysAgo(7),
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        sku: 'MNM-002',
        name: 'Teh Botol Sosro',
        category: 'Minuman',
        purchasePrice: 3800,
        sellingPrice: 5000,
        stock: 24,
        isActive: true,
        unitName: 'botol',
        bulkUnitName: 'dus',
        piecesPerBulk: 24,
        createdAt: daysAgo(7),
        updatedAt: daysAgo(7),
      },
      {
        id: '44444444-4444-4444-4444-444444444444',
        sku: 'MNM-003',
        name: 'Kopi Kapal Api Sachet',
        category: 'Minuman',
        purchasePrice: 1100,
        sellingPrice: 1500,
        stock: 40,
        isActive: true,
        unitName: 'sachet',
        bulkUnitName: 'renteng',
        piecesPerBulk: 10,
        createdAt: daysAgo(7),
        updatedAt: daysAgo(7),
      },
      {
        id: '55555555-5555-5555-5555-555555555555',
        sku: 'SMB-001',
        name: 'Minyak Goreng 1L',
        category: 'Sembako',
        purchasePrice: 17500,
        sellingPrice: 19500,
        stock: 12,
        isActive: true,
        unitName: 'pouch',
        bulkUnitName: 'dus',
        piecesPerBulk: 12,
        createdAt: daysAgo(7),
        updatedAt: daysAgo(7),
      },
      {
        id: '66666666-6666-6666-6666-666666666666',
        sku: 'SMB-002',
        name: 'Gula Pasir 1 kg',
        category: 'Sembako',
        purchasePrice: 15500,
        sellingPrice: 17500,
        stock: 8,
        isActive: true,
        unitName: 'kg',
        bulkUnitName: 'bal',
        piecesPerBulk: 20,
        createdAt: daysAgo(7),
        updatedAt: daysAgo(7),
      },
      {
        id: '77777777-7777-7777-7777-777777777777',
        sku: 'RT-001',
        name: 'Sabun Mandi Lifebuoy',
        category: 'Kebutuhan Rumah Tangga',
        purchasePrice: 2800,
        sellingPrice: 3500,
        stock: 10,
        isActive: true,
        unitName: 'pcs',
        bulkUnitName: 'dus',
        piecesPerBulk: 48,
        createdAt: daysAgo(7),
        updatedAt: daysAgo(7),
      },
      {
        id: '88888888-8888-8888-8888-888888888888',
        sku: 'SNK-001',
        name: 'Biskuit Roma Kelapa',
        category: 'Makanan Ringan',
        purchasePrice: 6500,
        sellingPrice: 8000,
        stock: 20,
        isActive: true,
        unitName: 'bungkus',
        bulkUnitName: 'dus',
        piecesPerBulk: 24,
        createdAt: daysAgo(7),
        updatedAt: daysAgo(7),
      },
      {
        id: '99999999-9999-9999-9999-999999999999',
        sku: 'SMB-003',
        name: 'Beras Ramos 5 kg',
        category: 'Sembako',
        purchasePrice: 62000,
        sellingPrice: 68000,
        stock: 3,
        isActive: true,
        unitName: 'karung',
        bulkUnitName: 'karung',
        piecesPerBulk: 1,
        createdAt: daysAgo(7),
        updatedAt: daysAgo(7),
      },
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        sku: 'SMB-004',
        name: 'Garam Dapur Cap Kapal',
        category: 'Sembako',
        purchasePrice: 2500,
        sellingPrice: 3500,
        stock: 4,
        isActive: true,
        unitName: 'bungkus',
        bulkUnitName: 'bal',
        piecesPerBulk: 20,
        createdAt: daysAgo(7),
        updatedAt: daysAgo(7),
      },
    ];

    // Initial stock movements for products
    for (const p of this.products) {
      this.movements.push({
        id: randomUUID(),
        productId: p.id,
        productName: p.name,
        productSku: p.sku,
        productIsActive: p.isActive,
        type: 'INITIAL',
        quantity: p.stock,
        beforeStock: 0,
        afterStock: p.stock,
        referenceType: null,
        referenceId: null,
        referenceLabel: null,
        note: 'Stok awal warung',
        createdAt: p.createdAt,
      });
    }

    // 2. Seed Suppliers
    const supplier1Id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const supplier2Id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    this.suppliers = [
      {
        id: supplier1Id,
        name: 'Pak Haji (Sales Grosir)',
        phone: '0812-3456-7890',
        isActive: true,
        createdAt: daysAgo(10),
        updatedAt: daysAgo(10),
      },
      {
        id: supplier2Id,
        name: 'Toko Grosir Madura Jaya',
        phone: '0878-9988-7766',
        isActive: true,
        createdAt: daysAgo(10),
        updatedAt: daysAgo(10),
      },
    ];

    // 3. Seed Restock Order 1 (Partial delivery scenario - Chat 1, 3, 6, 8, 9)
    const order1Id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    const order1Item1Id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
    const order1Item2Id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const receipt1Id = '12121212-1212-1212-1212-121212121212';

    this.restockOrders = [
      {
        id: order1Id,
        orderNumber: 'RST-20261008-0001',
        supplierId: supplier1Id,
        supplierName: 'Pak Haji (Sales Grosir)',
        status: 'PARTIAL',
        notes: 'Saya kulakan ke sales Pak Haji. Pesan dulu lewat WA, nanti barangnya diantar (Chat 2). Catat per dus biar gampang (Chat 5).',
        orderedAt: daysAgo(2),
        items: [
          {
            id: order1Item1Id,
            productId: this.products[0].id, // Indomie
            productName: this.products[0].name,
            productSku: this.products[0].sku,
            quantityOrdered: 5,
            quantityReceived: 3,
            unitName: 'dus',
            piecesPerUnit: 40,
            purchasePrice: 112000,
            status: 'PARTIAL',
          },
          {
            id: order1Item2Id,
            productId: this.products[1].id, // Aqua
            productName: this.products[1].name,
            productSku: this.products[1].sku,
            quantityOrdered: 3,
            quantityReceived: 3,
            unitName: 'dus',
            piecesPerUnit: 24,
            purchasePrice: 55200,
            status: 'FULFILLED',
          },
        ],
        receipts: [
          {
            id: receipt1Id,
            receiptNumber: 'RCV-20261008-0001',
            receivedBy: 'Udin (Pagi)',
            notes: 'Pesan mie 5 dus datang 3, sisanya besok (Chat 3). Ada 1 dus penyok jangan dijual untuk klaim sales (Chat 9). Sales kasih bonus beli 10 gratis 1 (Chat 8).',
            receivedAt: daysAgo(1),
            items: [
              {
                id: randomUUID(),
                productId: this.products[0].id,
                productName: this.products[0].name,
                productSku: this.products[0].sku,
                quantityGood: 3,
                quantityDamaged: 1,
                quantityBonus: 1,
                purchasePrice: 112000,
                unitName: 'dus',
                piecesPerUnit: 40,
                notes: '1 dus penyok ditandai klaim',
              },
              {
                id: randomUUID(),
                productId: this.products[1].id,
                productName: this.products[1].name,
                productSku: this.products[1].sku,
                quantityGood: 3,
                quantityDamaged: 0,
                quantityBonus: 0,
                purchasePrice: 55200,
                unitName: 'dus',
                piecesPerUnit: 24,
                notes: null,
              },
            ],
          },
        ],
      },
    ];

    // 4. Seed Stock Movements for Restock Receipt 1
    this.movements.unshift({
      id: randomUUID(),
      productId: this.products[0].id,
      productName: this.products[0].name,
      productSku: this.products[0].sku,
      productIsActive: true,
      type: 'RESTOCK',
      quantity: 120, // 3 dus * 40
      beforeStock: 60,
      afterStock: 180,
      referenceType: 'RESTOCK_RECEIPT',
      referenceId: receipt1Id,
      referenceLabel: 'RCV-20261008-0001',
      note: 'Restock 3 dus Indomie Goreng (×40 pcs) dari RST-20261008-0001',
      createdAt: daysAgo(1),
    });

    this.movements.unshift({
      id: randomUUID(),
      productId: this.products[0].id,
      productName: this.products[0].name,
      productSku: this.products[0].sku,
      productIsActive: true,
      type: 'RESTOCK_BONUS',
      quantity: 40, // 1 dus bonus * 40
      beforeStock: 180,
      afterStock: 220,
      referenceType: 'RESTOCK_RECEIPT',
      referenceId: receipt1Id,
      referenceLabel: 'RCV-20261008-0001',
      note: 'Bonus 1 dus Indomie Goreng dari sales Pak Haji',
      createdAt: daysAgo(1),
    });

    this.movements.unshift({
      id: randomUUID(),
      productId: this.products[0].id,
      productName: this.products[0].name,
      productSku: this.products[0].sku,
      productIsActive: true,
      type: 'DAMAGED_IN',
      quantity: 40, // 1 dus penyok
      beforeStock: 220,
      afterStock: 220,
      referenceType: 'RESTOCK_RECEIPT',
      referenceId: receipt1Id,
      referenceLabel: 'RCV-20261008-0001',
      note: 'Barang rusak: 1 dus Indomie — kemasan penyok klaim sales',
      createdAt: daysAgo(1),
    });

    // 5. Seed Inventory Check (Chat 11)
    const check1Id = '23232323-2323-2323-2323-232323232323';
    this.inventoryChecks = [
      {
        id: check1Id,
        checkNumber: 'OPN-20261009-0001',
        checkedBy: 'Cak Rofi',
        status: 'COMPLETED',
        notes: 'Kalau habis hitung stok terus beda, saya mau bisa betulin, tapi harus ada alasannya. Stok jangan sampai minus (Chat 11).',
        checkedAt: daysAgo(1),
        items: [
          {
            id: randomUUID(),
            productId: this.products[0].id,
            productName: this.products[0].name,
            productSku: this.products[0].sku,
            systemStock: 220,
            physicalStock: 218,
            difference: -2,
            reason: 'Kemasan sobek saat bongkar muatan',
            notes: '2 bungkus disisihkan',
          },
        ],
      },
    ];

    this.movements.unshift({
      id: randomUUID(),
      productId: this.products[0].id,
      productName: this.products[0].name,
      productSku: this.products[0].sku,
      productIsActive: true,
      type: 'OPNAME_OUT',
      quantity: 2,
      beforeStock: 220,
      afterStock: 218,
      referenceType: 'INVENTORY_CHECK',
      referenceId: check1Id,
      referenceLabel: 'OPN-20261009-0001',
      note: 'Stok opname: Kemasan sobek saat bongkar muatan',
      createdAt: daysAgo(1),
    });

    // 6. Seed Sales
    const sale1Id = '34343434-3434-3434-3434-343434343434';
    this.sales = [
      {
        id: sale1Id,
        invoiceNumber: 'INV-20261010-0001',
        total: 23500,
        createdAt: now.toISOString(),
        createdByUserId: null,
        items: [
          {
            id: randomUUID(),
            productId: this.products[0].id,
            productName: this.products[0].name,
            productSku: this.products[0].sku,
            productIsActive: true,
            quantity: 3,
            unitPrice: 3500,
            subtotal: 10500,
          },
          {
            id: randomUUID(),
            productId: this.products[1].id,
            productName: this.products[1].name,
            productSku: this.products[1].sku,
            productIsActive: true,
            quantity: 2,
            unitPrice: 3000,
            subtotal: 6000,
          },
          {
            id: randomUUID(),
            productId: this.products[3].id,
            productName: this.products[3].name,
            productSku: this.products[3].sku,
            productIsActive: true,
            quantity: 4,
            unitPrice: 1500,
            subtotal: 6000,
          },
        ],
      },
    ];
  }

  // --- PRODUCT METHODS ---
  listProducts(filter: { search?: string; inStock?: boolean } = {}): ProductDto[] {
    let result = [...this.products];
    if (filter.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q),
      );
    }
    if (filter.inStock) {
      result = result.filter((p) => p.isActive && p.stock > 0);
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  getProduct(id: string): ProductDto {
    const p = this.products.find((prod) => prod.id === id);
    if (!p) throw new NotFoundError('Produk tidak ditemukan.');
    return { ...p };
  }

  createProduct(input: {
    sku: string;
    name: string;
    category: string;
    purchasePrice: number;
    sellingPrice: number;
    stock: number;
  }): ProductDto {
    if (this.products.some((p) => p.sku === input.sku)) {
      throw new ConflictError('SKU sudah digunakan oleh produk lain.');
    }
    const now = new Date().toISOString();
    const newProd: InternalProduct = {
      id: randomUUID(),
      sku: input.sku,
      name: input.name,
      category: input.category,
      purchasePrice: input.purchasePrice,
      sellingPrice: input.sellingPrice,
      stock: input.stock,
      isActive: true,
      unitName: 'pcs',
      createdAt: now,
      updatedAt: now,
    };
    this.products.push(newProd);

    if (newProd.stock > 0) {
      this.movements.unshift({
        id: randomUUID(),
        productId: newProd.id,
        productName: newProd.name,
        productSku: newProd.sku,
        productIsActive: true,
        type: 'INITIAL',
        quantity: newProd.stock,
        beforeStock: 0,
        afterStock: newProd.stock,
        referenceType: null,
        referenceId: null,
        referenceLabel: null,
        note: 'Stok awal',
        createdAt: now,
      });
    }

    return { ...newProd };
  }

  updateProduct(id: string, input: Partial<InternalProduct>): ProductDto {
    const p = this.products.find((prod) => prod.id === id);
    if (!p) throw new NotFoundError('Produk tidak ditemukan.');
    if (input.sku && input.sku !== p.sku && this.products.some((other) => other.sku === input.sku)) {
      throw new ConflictError('SKU sudah digunakan oleh produk lain.');
    }
    Object.assign(p, input, { updatedAt: new Date().toISOString() });
    return { ...p };
  }

  setProductStatus(id: string, isActive: boolean): ProductDto {
    const p = this.products.find((prod) => prod.id === id);
    if (!p) throw new NotFoundError('Produk tidak ditemukan.');
    p.isActive = isActive;
    p.updatedAt = new Date().toISOString();
    return { ...p };
  }

  deleteProduct(id: string) {
    const pIndex = this.products.findIndex((prod) => prod.id === id);
    if (pIndex === -1) throw new NotFoundError('Produk tidak ditemukan.');
    this.products.splice(pIndex, 1);
  }

  // --- DASHBOARD METHODS ---
  getDashboard(): DashboardDto {
    const activeProducts = this.products.filter((p) => p.isActive);
    const totalProducts = activeProducts.length;
    const totalUnits = activeProducts.reduce((sum, p) => sum + p.stock, 0);
    const todaySalesTotal = this.sales.reduce((sum, s) => sum + s.total, 0);
    const lowStockProducts = activeProducts
      .filter((p) => p.stock <= LOW_STOCK_THRESHOLD)
      .sort((a, b) => a.stock - b.stock);

    return {
      totalProducts,
      totalUnits,
      todaySalesTotal,
      lowStockCount: lowStockProducts.length,
      lowStockThreshold: LOW_STOCK_THRESHOLD,
      latestSales: this.listSales().slice(0, 5),
      lowStockProducts: lowStockProducts.slice(0, 10),
    };
  }

  // --- SALE METHODS ---
  listSales(createdByUserId?: string): SaleSummaryDto[] {
    return this.sales
      .filter((sale) => createdByUserId === undefined || sale.createdByUserId === createdByUserId)
      .map((s) => ({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        total: s.total,
        itemCount: s.items.length,
        createdAt: s.createdAt,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getSale(id: string, createdByUserId?: string): SaleDetailDto {
    const s = this.sales.find((sale) => sale.id === id);
    if (!s || (createdByUserId !== undefined && s.createdByUserId !== createdByUserId)) {
      throw new NotFoundError('Penjualan tidak ditemukan.');
    }
    return {
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      total: s.total,
      createdAt: s.createdAt,
      items: s.items,
    };
  }

  createSale(
    input: { items: { productId: string; quantity: number }[] },
    createdByUserId: string,
  ): SaleDetailDto {
    const now = new Date();
    const invoiceNumber = `INV-${now.toISOString().slice(0, 10).replaceAll('-', '')}-${String(this.sales.length + 1).padStart(4, '0')}`;

    let total = 0;
    const items = input.items.map((item) => {
      const product = this.products.find((p) => p.id === item.productId);
      if (!product) throw new NotFoundError('Produk tidak ditemukan.');
      if (!product.isActive) throw new ConflictError('Produk tidak aktif dan tidak dapat dijual.');
      if (product.stock < item.quantity) {
        throw new ConflictError(`Stok ${product.name} tidak mencukupi. Tersedia ${product.stock}.`);
      }

      product.stock -= item.quantity;
      const subtotal = product.sellingPrice * item.quantity;
      total += subtotal;

      this.movements.unshift({
        id: randomUUID(),
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        productIsActive: product.isActive,
        type: 'SALE',
        quantity: item.quantity,
        beforeStock: product.stock + item.quantity,
        afterStock: product.stock,
        referenceType: 'SALE',
        referenceId: invoiceNumber,
        referenceLabel: invoiceNumber,
        note: `Penjualan ${invoiceNumber}`,
        createdAt: now.toISOString(),
      });

      return {
        id: randomUUID(),
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        productIsActive: product.isActive,
        quantity: item.quantity,
        unitPrice: product.sellingPrice,
        subtotal,
      };
    });

    const newSale: InternalSale = {
      id: randomUUID(),
      invoiceNumber,
      total,
      createdAt: now.toISOString(),
      createdByUserId,
      items,
    };
    this.sales.unshift(newSale);
    return this.getSale(newSale.id);
  }

  // --- STOCK MOVEMENT METHODS ---
  listStockMovements(filter: { productId?: string } = {}): StockMovementDto[] {
    let result = [...this.movements];
    if (filter.productId) {
      result = result.filter((m) => m.productId === filter.productId);
    }
    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  adjustStock(input: { productId: string; type: 'IN' | 'OUT'; quantity: number; note?: string }): StockMovementDto {
    const product = this.products.find((p) => p.id === input.productId);
    if (!product) throw new NotFoundError('Produk tidak ditemukan.');
    if (!product.isActive) throw new ConflictError('Produk tidak aktif.');

    if (input.type === 'OUT' && product.stock < input.quantity) {
      throw new ConflictError(`Stok ${product.name} tidak mencukupi. Tersedia ${product.stock}.`);
    }

    const beforeStock = product.stock;
    if (input.type === 'OUT') {
      product.stock -= input.quantity;
    } else {
      product.stock += input.quantity;
    }
    const afterStock = product.stock;

    const movement: StockMovementDto = {
      id: randomUUID(),
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      productIsActive: product.isActive,
      type: input.type === 'OUT' ? 'ADJUSTMENT_OUT' : 'ADJUSTMENT_IN',
      quantity: input.quantity,
      beforeStock,
      afterStock,
      referenceType: null,
      referenceId: null,
      referenceLabel: null,
      note: input.note ?? null,
      createdAt: new Date().toISOString(),
    };
    this.movements.unshift(movement);
    return movement;
  }

  // --- SUPPLIER METHODS ---
  listSuppliers(): SupplierDto[] {
    return this.suppliers.filter((s) => s.isActive).sort((a, b) => a.name.localeCompare(b.name));
  }

  createSupplier(input: { name: string; phone?: string }): SupplierDto {
    const now = new Date().toISOString();
    const newSupplier: InternalSupplier = {
      id: randomUUID(),
      name: input.name,
      phone: input.phone ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    this.suppliers.push(newSupplier);
    return { ...newSupplier };
  }

  // --- RESTOCK METHODS ---
  listRestockOrders(): RestockOrderSummaryDto[] {
    return this.restockOrders
      .map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        supplierName: o.supplierName,
        status: o.status,
        itemCount: o.items.length,
        orderedAt: o.orderedAt,
      }))
      .sort((a, b) => b.orderedAt.localeCompare(a.orderedAt));
  }

  getRestockOrder(id: string): RestockOrderDetailDto {
    const o = this.restockOrders.find((order) => order.id === id);
    if (!o) throw new NotFoundError('Pesanan restock tidak ditemukan.');
    return { ...o };
  }

  createRestockOrder(input: {
    supplierId: string;
    notes?: string;
    items: {
      productId: string;
      quantityOrdered: number;
      unitName: string;
      piecesPerUnit: number;
      purchasePrice: number;
    }[];
  }): RestockOrderDetailDto {
    const supplier = this.suppliers.find((s) => s.id === input.supplierId);
    if (!supplier) throw new NotFoundError('Supplier tidak ditemukan.');

    const now = new Date();
    const orderNumber = `RST-${now.toISOString().slice(0, 10).replaceAll('-', '')}-${String(this.restockOrders.length + 1).padStart(4, '0')}`;

    const items: RestockOrderItemDto[] = input.items.map((i) => {
      const prod = this.products.find((p) => p.id === i.productId);
      if (!prod) throw new NotFoundError('Produk tidak ditemukan.');
      return {
        id: randomUUID(),
        productId: prod.id,
        productName: prod.name,
        productSku: prod.sku,
        quantityOrdered: i.quantityOrdered,
        quantityReceived: 0,
        unitName: i.unitName,
        piecesPerUnit: i.piecesPerUnit,
        purchasePrice: i.purchasePrice,
        status: 'PENDING',
      };
    });

    const newOrder: InternalRestockOrder = {
      id: randomUUID(),
      orderNumber,
      supplierId: supplier.id,
      supplierName: supplier.name,
      status: 'PENDING',
      notes: input.notes ?? null,
      orderedAt: now.toISOString(),
      items,
      receipts: [],
    };

    this.restockOrders.unshift(newOrder);
    return this.getRestockOrder(newOrder.id);
  }

  cancelRestockOrder(id: string): RestockOrderDetailDto {
    const o = this.restockOrders.find((order) => order.id === id);
    if (!o) throw new NotFoundError('Pesanan restock tidak ditemukan.');
    if (o.status === 'COMPLETED') throw new ConflictError('Pesanan yang sudah selesai tidak bisa dibatalkan.');
    o.status = 'CANCELLED';
    for (const item of o.items) {
      item.status = 'CANCELLED';
    }
    return { ...o };
  }

  createRestockReceipt(
    orderId: string,
    receivedBy: string,
    input: {
      idempotencyKey: string;
      notes?: string;
      items: {
        restockOrderItemId: string;
        quantityGood: number;
        quantityDamaged?: number;
        quantityBonus?: number;
        notes?: string;
      }[];
    },
  ): RestockOrderDetailDto {
    // Idempotency guard (Chat 7)
    if (this.usedIdempotencyKeys.has(input.idempotencyKey)) {
      throw new ConflictError('Penerimaan sudah tercatat sebelumnya (duplikat simpan).');
    }
    this.usedIdempotencyKeys.add(input.idempotencyKey);

    const order = this.restockOrders.find((o) => o.id === orderId);
    if (!order) throw new NotFoundError('Pesanan restock tidak ditemukan.');
    if (order.status === 'CANCELLED') throw new ConflictError('Pesanan sudah dibatalkan.');
    if (order.status === 'COMPLETED') throw new ConflictError('Pesanan sudah selesai.');

    const now = new Date();
    const receiptNumber = `RCV-${now.toISOString().slice(0, 10).replaceAll('-', '')}-${String(order.receipts.length + 1).padStart(4, '0')}`;

    const receiptItems: RestockReceiptDto['items'] = [];

    for (const ri of input.items) {
      const orderItem = order.items.find((i) => i.id === ri.restockOrderItemId);
      if (!orderItem) continue;

      const good = ri.quantityGood || 0;
      const damaged = ri.quantityDamaged || 0;
      const bonus = ri.quantityBonus || 0;

      receiptItems.push({
        id: randomUUID(),
        productId: orderItem.productId,
        productName: orderItem.productName,
        productSku: orderItem.productSku,
        quantityGood: good,
        quantityDamaged: damaged,
        quantityBonus: bonus,
        purchasePrice: orderItem.purchasePrice,
        unitName: orderItem.unitName,
        piecesPerUnit: orderItem.piecesPerUnit,
        notes: ri.notes ?? null,
      });

      // Update order item progress
      orderItem.quantityReceived += good + damaged;
      if (orderItem.quantityReceived >= orderItem.quantityOrdered) {
        orderItem.status = 'FULFILLED';
      } else {
        orderItem.status = 'PARTIAL';
      }

      // Add good stock
      const goodPieces = good * orderItem.piecesPerUnit;
      const bonusPieces = bonus * orderItem.piecesPerUnit;
      const product = this.products.find((p) => p.id === orderItem.productId);

      if (product && goodPieces > 0) {
        const before = product.stock;
        product.stock += goodPieces;
        this.movements.unshift({
          id: randomUUID(),
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          productIsActive: product.isActive,
          type: 'RESTOCK',
          quantity: goodPieces,
          beforeStock: before,
          afterStock: product.stock,
          referenceType: 'RESTOCK_RECEIPT',
          referenceId: receiptNumber,
          referenceLabel: receiptNumber,
          note: `Restock ${good} ${orderItem.unitName} (×${orderItem.piecesPerUnit} pcs) dari ${order.orderNumber}`,
          createdAt: now.toISOString(),
        });
      }

      if (product && bonusPieces > 0) {
        const before = product.stock;
        product.stock += bonusPieces;
        this.movements.unshift({
          id: randomUUID(),
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          productIsActive: product.isActive,
          type: 'RESTOCK_BONUS',
          quantity: bonusPieces,
          beforeStock: before,
          afterStock: product.stock,
          referenceType: 'RESTOCK_RECEIPT',
          referenceId: receiptNumber,
          referenceLabel: receiptNumber,
          note: `Bonus ${bonus} ${orderItem.unitName} dari ${order.orderNumber}`,
          createdAt: now.toISOString(),
        });
      }

      if (product && damaged > 0) {
        this.movements.unshift({
          id: randomUUID(),
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          productIsActive: product.isActive,
          type: 'DAMAGED_IN',
          quantity: damaged * orderItem.piecesPerUnit,
          beforeStock: product.stock,
          afterStock: product.stock,
          referenceType: 'RESTOCK_RECEIPT',
          referenceId: receiptNumber,
          referenceLabel: receiptNumber,
          note: `Barang rusak: ${damaged} ${orderItem.unitName} — ${ri.notes ?? 'klaim ke sales'}`,
          createdAt: now.toISOString(),
        });
      }
    }

    const receipt: RestockReceiptDto = {
      id: randomUUID(),
      receiptNumber,
      receivedBy,
      notes: input.notes ?? null,
      receivedAt: now.toISOString(),
      items: receiptItems,
    };
    order.receipts.unshift(receipt);

    // Update order status
    const allFulfilled = order.items.every((i) => i.status === 'FULFILLED' || i.status === 'CANCELLED');
    order.status = allFulfilled ? 'COMPLETED' : 'PARTIAL';

    return { ...order };
  }

  // --- INVENTORY METHODS ---
  listInventoryChecks(): InventoryCheckSummaryDto[] {
    return this.inventoryChecks
      .map((c) => ({
        id: c.id,
        checkNumber: c.checkNumber,
        checkedBy: c.checkedBy,
        status: c.status,
        itemCount: c.items.length,
        totalDifference: c.items.reduce((sum, i) => sum + i.difference, 0),
        checkedAt: c.checkedAt,
      }))
      .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));
  }

  getInventoryCheck(id: string): InventoryCheckDetailDto {
    const c = this.inventoryChecks.find((check) => check.id === id);
    if (!c) throw new NotFoundError('Stok opname tidak ditemukan.');
    return { ...c };
  }

  createInventoryCheck(input: {
    notes?: string;
    items: { productId: string; physicalStock: number; reason: string; notes?: string }[];
  }, checkedBy: string): InventoryCheckDetailDto {
    const now = new Date();
    const checkNumber = `OPN-${now.toISOString().slice(0, 10).replaceAll('-', '')}-${String(this.inventoryChecks.length + 1).padStart(4, '0')}`;

    const items: InventoryCheckItemDto[] = [];

    for (const item of input.items) {
      const product = this.products.find((p) => p.id === item.productId);
      if (!product) throw new NotFoundError('Produk tidak ditemukan.');
      if (item.physicalStock < 0) throw new ConflictError('Stok fisik tidak boleh negatif.');

      const diff = item.physicalStock - product.stock;
      const beforeStock = product.stock;
      product.stock = item.physicalStock;

      items.push({
        id: randomUUID(),
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        systemStock: beforeStock,
        physicalStock: item.physicalStock,
        difference: diff,
        reason: item.reason,
        notes: item.notes ?? null,
      });

      if (diff !== 0) {
        this.movements.unshift({
          id: randomUUID(),
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          productIsActive: product.isActive,
          type: diff > 0 ? 'OPNAME_IN' : 'OPNAME_OUT',
          quantity: Math.abs(diff),
          beforeStock,
          afterStock: product.stock,
          referenceType: 'INVENTORY_CHECK',
          referenceId: checkNumber,
          referenceLabel: checkNumber,
          note: `Stok opname: ${item.reason}`,
          createdAt: now.toISOString(),
        });
      }
    }

    const newCheck: InternalInventoryCheck = {
      id: randomUUID(),
      checkNumber,
      checkedBy,
      status: 'COMPLETED',
      notes: input.notes ?? null,
      checkedAt: now.toISOString(),
      items,
    };

    this.inventoryChecks.unshift(newCheck);
    return this.getInventoryCheck(newCheck.id);
  }
}

export const mockStore = new MockDataStore();
