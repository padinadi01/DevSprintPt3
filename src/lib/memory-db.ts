import bcrypt from 'bcryptjs';
import {
  Prisma,
  UserRole,
  StockMovementType,
  PurchaseOrderStatus,
  GoodsReceiptStatus,
} from '@prisma/client';

export interface MemoryStore {
  users: any[];
  products: any[];
  stockMovements: any[];
  goodsReceipts: any[];
  goodsReceiptItems: any[];
  purchaseOrders: any[];
  purchaseOrderItems: any[];
  sales: any[];
  saleItems: any[];
  receivers: any[];
  suppliers: any[];
}

const saltRounds = 10;

function toDecimal(n: any) {
  return new Prisma.Decimal(n || 0);
}

function cloneItem<T>(item: T): T {
  if (!item || typeof item !== 'object') return item;
  if (item instanceof Prisma.Decimal) return new Prisma.Decimal(item.toString()) as any;
  if (item instanceof Date) return new Date(item.getTime()) as any;
  if (Array.isArray(item)) return item.map(cloneItem) as any;
  const copy: any = {};
  for (const [k, v] of Object.entries(item)) {
    copy[k] = cloneItem(v);
  }
  return copy;
}

function createInitialStore(): MemoryStore {
  const receivers = [
    { id: 'rec-pemilik', name: 'Cak Rofi (Pemilik)', code: 'ROFI', createdAt: new Date() },
    { id: 'rec-udin', name: 'Udin', code: 'UDIN', createdAt: new Date() },
    { id: 'rec-sari', name: 'Sari', code: 'SARI', createdAt: new Date() },
  ];

  const suppliers = [
    { id: 'sup-1', name: 'PT Sumber Pangan Sejahtera', code: 'SPS', contact: '081234567890', address: 'Surabaya', createdAt: new Date() },
    { id: 'sup-2', name: 'Agen Grosir Madura Jaya', code: 'AGM', contact: '082345678901', address: 'Bangkalan', createdAt: new Date() },
    { id: 'sup-3', name: 'Distributor Sembako Nusantara', code: 'DSN', contact: '083456789012', address: 'Jakarta', createdAt: new Date() },
  ];

  const users = [
    {
      id: 'usr-pemilik',
      username: 'pemilik',
      name: 'Cak Rofi (Pemilik)',
      pinHash: bcrypt.hashSync('1234', saltRounds),
      role: UserRole.PEMILIK,
      permissions: ['ALL', 'VIEW_STOCK', 'STOCK_IN', 'SALE', 'VIEW_REPORTS', 'MANAGE_USERS', 'MANAGE_SETTINGS'],
      receiverId: 'rec-pemilik',
      createdAt: new Date(),
    },
    {
      id: 'usr-udin',
      username: 'udin',
      name: 'Udin',
      pinHash: bcrypt.hashSync('1111', saltRounds),
      role: UserRole.STAF,
      permissions: ['VIEW_STOCK', 'STOCK_IN', 'SALE'],
      receiverId: 'rec-udin',
      createdAt: new Date(),
    },
    {
      id: 'usr-sari',
      username: 'sari',
      name: 'Sari',
      pinHash: bcrypt.hashSync('2222', saltRounds),
      role: UserRole.STAF,
      permissions: ['VIEW_STOCK', 'STOCK_IN', 'SALE'],
      receiverId: 'rec-sari',
      createdAt: new Date(),
    },
  ];

  const rawProducts = [
    { sku: 'MIE-001', name: 'Indomie Goreng', category: 'Makanan Instan', purchasePrice: 2800, sellingPrice: 3500, stock: 60, unitOfPurchase: 'dus', unitsPerPurchase: 40, baseUnit: 'bungkus' },
    { sku: 'MNM-001', name: 'Aqua 600 ml', category: 'Minuman', purchasePrice: 2300, sellingPrice: 3000, stock: 48, unitOfPurchase: 'dus', unitsPerPurchase: 24, baseUnit: 'botol' },
    { sku: 'MNM-002', name: 'Teh Botol', category: 'Minuman', purchasePrice: 3800, sellingPrice: 5000, stock: 24, unitOfPurchase: 'pcs', unitsPerPurchase: 1, baseUnit: 'botol' },
    { sku: 'MNM-003', name: 'Kopi Sachet', category: 'Minuman', purchasePrice: 1100, sellingPrice: 1500, stock: 40, unitOfPurchase: 'renteng', unitsPerPurchase: 10, baseUnit: 'sachet' },
    { sku: 'SMB-001', name: 'Minyak Goreng 1L', category: 'Sembako', purchasePrice: 17500, sellingPrice: 19500, stock: 12, unitOfPurchase: 'pcs', unitsPerPurchase: 1, baseUnit: 'botol' },
    { sku: 'SMB-002', name: 'Gula 1 kg', category: 'Sembako', purchasePrice: 15500, sellingPrice: 17500, stock: 8, unitOfPurchase: 'bal', unitsPerPurchase: 20, baseUnit: 'kg' },
    { sku: 'RT-001', name: 'Sabun Mandi', category: 'Kebutuhan Rumah Tangga', purchasePrice: 2800, sellingPrice: 3500, stock: 10, unitOfPurchase: 'pcs', unitsPerPurchase: 1, baseUnit: 'pcs' },
    { sku: 'SNK-001', name: 'Biskuit', category: 'Makanan Ringan', purchasePrice: 6500, sellingPrice: 8000, stock: 20, unitOfPurchase: 'pcs', unitsPerPurchase: 1, baseUnit: 'bungkus' },
    { sku: 'SMB-003', name: 'Beras 5 kg', category: 'Sembako', purchasePrice: 62000, sellingPrice: 68000, stock: 3, unitOfPurchase: 'pcs', unitsPerPurchase: 1, baseUnit: 'karung' },
    { sku: 'SMB-004', name: 'Garam Dapur', category: 'Sembako', purchasePrice: 2500, sellingPrice: 3500, stock: 4, unitOfPurchase: 'pcs', unitsPerPurchase: 1, baseUnit: 'bungkus' },
    { sku: 'KOPI', name: 'Kopi sachet', category: 'Minuman', purchasePrice: 1400, sellingPrice: 1800, stock: 5, unitOfPurchase: 'renteng', unitsPerPurchase: 10, baseUnit: 'sachet' },
    { sku: 'MIE', name: 'Mi instan', category: 'Makanan Instan', purchasePrice: 2875, sellingPrice: 3500, stock: 12, unitOfPurchase: 'dus', unitsPerPurchase: 40, baseUnit: 'bungkus' },
    { sku: 'AIR600', name: 'Air mineral 600 ml', category: 'Minuman', purchasePrice: 2000, sellingPrice: 3000, stock: 0, unitOfPurchase: 'dus', unitsPerPurchase: 24, baseUnit: 'botol' },
    { sku: 'GULA', name: 'Gula 1 kg', category: 'Sembako', purchasePrice: 15000, sellingPrice: 17500, stock: 3, unitOfPurchase: 'bal', unitsPerPurchase: 20, baseUnit: 'pcs' },
  ];

  const products = rawProducts.map((p, idx) => ({
    id: `prod-${idx + 1}`,
    ...p,
    purchasePrice: toDecimal(p.purchasePrice),
    sellingPrice: toDecimal(p.sellingPrice),
    isActive: true,
    deletedAt: null,
    createdAt: new Date(Date.now() - 7 * 86400000),
    updatedAt: new Date(Date.now() - 7 * 86400000),
  }));

  const stockMovements: any[] = [];
  products.forEach((prod) => {
    // Record initial ledger entry for all products so stock counts match StockMovement history exactly
    stockMovements.push({
      id: `sm-init-${prod.id}`,
      productId: prod.id,
      type: StockMovementType.INITIAL,
      quantity: prod.stock,
      beforeStock: 0,
      afterStock: prod.stock,
      note: 'Stok awal sistem',
      referenceType: 'INITIAL',
      referenceId: null,
      createdAt: new Date(Date.now() - 7 * 86400000),
    });
  });

  // Example PO and Receipt for testing with valid schema fields
  const po1 = {
    id: 'po-1',
    supplierId: 'sup-1',
    status: PurchaseOrderStatus.OPEN,
    orderDate: new Date(Date.now() - 2 * 86400000),
    note: 'Pesanan restock mingguan',
    createdAt: new Date(Date.now() - 2 * 86400000),
    updatedAt: new Date(Date.now() - 2 * 86400000),
  };

  const poItems = [
    {
      id: 'poi-1',
      purchaseOrderId: 'po-1',
      productId: products[4].id, // Minyak Goreng 1L
      orderedQty: 10,
      unitPrice: 17500,
      receivedQty: 2,
    },
    {
      id: 'poi-2',
      purchaseOrderId: 'po-1',
      productId: products[0].id, // Indomie Goreng
      orderedQty: 5,
      unitPrice: 2800,
      receivedQty: 5,
    },
  ];

  return {
    users,
    products,
    stockMovements,
    goodsReceipts: [],
    goodsReceiptItems: [],
    purchaseOrders: [po1],
    purchaseOrderItems: poItems,
    sales: [],
    saleItems: [],
    receivers,
    suppliers,
  };
}

let store: MemoryStore = createInitialStore();

function matchesWhere(item: any, where?: any): boolean {
  if (!where) return true;
  for (const [key, val] of Object.entries(where)) {
    if (key === 'OR' && Array.isArray(val)) {
      const orMatched = val.some((subWhere) => matchesWhere(item, subWhere));
      if (!orMatched) return false;
      continue;
    }
    if (key === 'AND' && Array.isArray(val)) {
      const andMatched = val.every((subWhere) => matchesWhere(item, subWhere));
      if (!andMatched) return false;
      continue;
    }
    if (key === 'NOT') {
      if (matchesWhere(item, val)) return false;
      continue;
    }

    const itemVal = item[key];
    if (val === null || val === undefined) {
      if (itemVal !== val) return false;
      continue;
    }
    if (typeof val === 'object') {
      if ('equals' in val) {
        const eqVal = (val as any).equals;
        const mode = (val as any).mode;
        if (mode === 'insensitive' && typeof itemVal === 'string' && typeof eqVal === 'string') {
          if (itemVal.toLowerCase() !== eqVal.toLowerCase()) return false;
        } else {
          if (itemVal !== eqVal) return false;
        }
      }
      if ('in' in val && Array.isArray((val as any).in)) {
        if (!(val as any).in.includes(itemVal)) return false;
      }
      if ('contains' in val) {
        const c = String((val as any).contains).toLowerCase();
        if (!String(itemVal || '').toLowerCase().includes(c)) return false;
      }
      if ('lte' in val && !(itemVal <= (val as any).lte)) return false;
      if ('lt' in val && !(itemVal < (val as any).lt)) return false;
      if ('gte' in val && !(itemVal >= (val as any).gte)) return false;
      if ('gt' in val && !(itemVal > (val as any).gt)) return false;
      if ('not' in val && itemVal === (val as any).not) return false;
    } else {
      if (itemVal !== val) return false;
    }
  }
  return true;
}

function deepClone<T>(obj: T): T {
  return cloneItem(obj);
}

let nextId = 1000;
function genId(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${(nextId++).toString(36)}`;
}

export function createMemoryDb(): any {
  return {
    user: {
      async findFirst(args?: any) {
        const u = store.users.find((item) => matchesWhere(item, args?.where));
        if (!u) return null;
        const res = deepClone(u);
        if (args?.select?.receiver) {
          res.receiver = store.receivers.find((r) => r.id === u.receiverId) || null;
        }
        return res;
      },
      async findUnique(args: any) {
        const u = store.users.find((item) => matchesWhere(item, args?.where));
        if (!u) return null;
        const res = deepClone(u);
        if (args?.select?.receiver) {
          res.receiver = store.receivers.find((r) => r.id === u.receiverId) || null;
        }
        return res;
      },
      async findMany(args?: any) {
        let list = store.users.filter((item) => matchesWhere(item, args?.where));
        if (args?.orderBy) {
          list = [...list].sort((a, b) => String(a.role).localeCompare(String(b.role)));
        }
        return list.map((u) => {
          const res = deepClone(u);
          if (args?.select?.receiver) {
            res.receiver = store.receivers.find((r) => r.id === u.receiverId) || null;
          }
          return res;
        });
      },
      async create(args: any) {
        const newUser = {
          id: genId('usr'),
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.users.push(newUser);
        return deepClone(newUser);
      },
      async update(args: any) {
        const idx = store.users.findIndex((item) => matchesWhere(item, args.where));
        if (idx === -1) throw new Error('User not found');
        store.users[idx] = { ...store.users[idx], ...args.data, updatedAt: new Date() };
        return deepClone(store.users[idx]);
      },
      async count(args?: any) {
        let list = store.users;
        if (args?.where) {
          list = list.filter((item) => matchesWhere(item, args.where));
        }
        return list.length;
      },
      async delete(args: any) {
        const idx = store.users.findIndex((item) => matchesWhere(item, args.where));
        if (idx === -1) {
          const err: any = new Error('Record to delete does not exist.');
          err.code = 'P2025';
          throw err;
        }
        const deleted = store.users.splice(idx, 1)[0];
        return deepClone(deleted);
      },
    },

    product: {
      async findMany(args?: any) {
        let list = store.products.filter((item) => matchesWhere(item, args?.where));
        if (args?.orderBy?.name === 'asc') {
          list = [...list].sort((a, b) => a.name.localeCompare(b.name));
        }
        return deepClone(list);
      },
      async findUnique(args: any) {
        const p = store.products.find((item) => matchesWhere(item, args.where));
        return p ? deepClone(p) : null;
      },
      async findFirst(args?: any) {
        const p = store.products.find((item) => matchesWhere(item, args?.where));
        return p ? deepClone(p) : null;
      },
      async count(args?: any) {
        return store.products.filter((item) => matchesWhere(item, args?.where)).length;
      },
      async aggregate(args?: any) {
        const list = store.products.filter((item) => matchesWhere(item, args?.where));
        const sumStock = list.reduce((acc, curr) => acc + (curr.stock || 0), 0);
        return { _sum: { stock: sumStock } };
      },
      async create(args: any) {
        const newProd = {
          id: genId('prod'),
          ...args.data,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.products.push(newProd);
        return deepClone(newProd);
      },
      async update(args: any) {
        const idx = store.products.findIndex((item) => matchesWhere(item, args.where));
        if (idx === -1) throw new Error('Product not found');
        store.products[idx] = { ...store.products[idx], ...args.data, updatedAt: new Date() };
        return deepClone(store.products[idx]);
      },
    },

    stockMovement: {
      async findMany(args?: any) {
        let list = store.stockMovements.filter((item) => matchesWhere(item, args?.where));
        if (args?.include?.product) {
          list = list.map((sm) => ({
            ...sm,
            product: store.products.find((p) => p.id === sm.productId) || null,
          }));
        }
        list = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return deepClone(list);
      },
      async create(args: any) {
        const newSm = {
          id: genId('sm'),
          ...args.data,
          createdAt: args.data.createdAt || new Date(),
        };
        store.stockMovements.unshift(newSm);
        return deepClone(newSm);
      },
      async groupBy() {
        return [];
      },
    },

    goodsReceipt: {
      async findMany(args?: any) {
        let list = store.goodsReceipts.filter((item) => matchesWhere(item, args?.where));
        return list.map((gr) => {
          const res = deepClone(gr);
          if (args?.include?.receiver) {
            res.receiver = store.receivers.find((r) => r.id === gr.receiverId) || null;
          }
          if (args?.include?.supplier) {
            res.supplier = store.suppliers.find((s) => s.id === gr.supplierId) || null;
          }
          if (args?.include?.purchaseOrder) {
            res.purchaseOrder = store.purchaseOrders.find((po) => po.id === gr.purchaseOrderId) || null;
          }
          if (args?.include?.items) {
            res.items = store.goodsReceiptItems
              .filter((it) => it.receiptId === gr.id || it.goodsReceiptId === gr.id)
              .map((it) => {
                const itemClone = deepClone(it);
                if (args.include.items?.include?.product) {
                  itemClone.product = store.products.find((p) => p.id === it.productId) || null;
                }
                return itemClone;
              });
          }
          return res;
        });
      },
      async findUnique(args: any) {
        const gr = store.goodsReceipts.find((item) => matchesWhere(item, args.where));
        if (!gr) return null;
        const res = deepClone(gr);
        if (args?.include?.receiver) {
          res.receiver = store.receivers.find((r) => r.id === gr.receiverId) || null;
        }
        if (args?.include?.supplier) {
          res.supplier = store.suppliers.find((s) => s.id === gr.supplierId) || null;
        }
        if (args?.include?.purchaseOrder) {
          res.purchaseOrder = store.purchaseOrders.find((po) => po.id === gr.purchaseOrderId) || null;
        }
        if (args?.include?.items) {
          res.items = store.goodsReceiptItems
            .filter((it) => it.receiptId === gr.id || it.goodsReceiptId === gr.id)
            .map((it) => {
              const itemClone = deepClone(it);
              if (args.include.items?.include?.product) {
                itemClone.product = store.products.find((p) => p.id === it.productId) || null;
              }
              return itemClone;
            });
        }
        return res;
      },
      async create(args: any) {
        const newGr = {
          id: genId('gr'),
          ...args.data,
          receivedAt: args.data.receivedAt || new Date(),
          status: args.data.status || GoodsReceiptStatus.RECEIVED,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.goodsReceipts.unshift(newGr);
        return deepClone(newGr);
      },
      async update(args: any) {
        const idx = store.goodsReceipts.findIndex((item) => matchesWhere(item, args.where));
        if (idx === -1) throw new Error('GoodsReceipt not found');
        store.goodsReceipts[idx] = { ...store.goodsReceipts[idx], ...args.data, updatedAt: new Date() };
        return deepClone(store.goodsReceipts[idx]);
      },
    },

    goodsReceiptItem: {
      async findMany(args?: any) {
        let list = store.goodsReceiptItems.filter((item) => matchesWhere(item, args?.where));
        if (args?.include?.product) {
          list = list.map((it) => ({
            ...it,
            product: store.products.find((p) => p.id === it.productId) || null,
          }));
        }
        return deepClone(list);
      },
      async create(args: any) {
        const newItem = {
          id: genId('gri'),
          ...args.data,
          createdAt: args.data.createdAt || new Date(),
        };
        store.goodsReceiptItems.push(newItem);
        return deepClone(newItem);
      },
      async createMany(args: any) {
        const items = args.data.map((d: any) => ({
          id: genId('gri'),
          ...d,
          createdAt: d.createdAt || new Date(),
        }));
        store.goodsReceiptItems.push(...items);
        return { count: items.length };
      },
    },

    purchaseOrder: {
      async findMany(args?: any) {
        let list = store.purchaseOrders.filter((item) => matchesWhere(item, args?.where));
        return list.map((po) => {
          const res = deepClone(po);
          if (args?.include?.supplier) {
            res.supplier = store.suppliers.find((s) => s.id === po.supplierId) || null;
          }
          if (args?.include?.items) {
            res.items = store.purchaseOrderItems
              .filter((it) => it.purchaseOrderId === po.id)
              .map((it) => {
                const itClone = deepClone(it);
                if (args.include.items?.include?.product) {
                  itClone.product = store.products.find((p) => p.id === it.productId) || null;
                }
                return itClone;
              });
          }
          return res;
        });
      },
      async findUnique(args: any) {
        const po = store.purchaseOrders.find((item) => matchesWhere(item, args.where));
        if (!po) return null;
        const res = deepClone(po);
        if (args?.include?.supplier) {
          res.supplier = store.suppliers.find((s) => s.id === po.supplierId) || null;
        }
        if (args?.include?.items) {
          res.items = store.purchaseOrderItems
            .filter((it) => it.purchaseOrderId === po.id)
            .map((it) => {
              const itClone = deepClone(it);
              if (args.include.items?.include?.product) {
                itClone.product = store.products.find((p) => p.id === it.productId) || null;
              }
              return itClone;
            });
        }
        return res;
      },
      async create(args: any) {
        const id = genId('po');
        const { items, ...poData } = args.data;
        const newPo = {
          id,
          ...poData,
          status: poData.status || PurchaseOrderStatus.OPEN,
          orderDate: poData.orderDate ? new Date(poData.orderDate) : new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.purchaseOrders.unshift(newPo);

        if (items?.create && Array.isArray(items.create)) {
          for (const it of items.create) {
            const newItem = {
              id: genId('poi'),
              purchaseOrderId: id,
              ...it,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            store.purchaseOrderItems.push(newItem);
          }
        }

        const res = deepClone(newPo);
        if (args?.include?.supplier) {
          res.supplier = store.suppliers.find((s) => s.id === newPo.supplierId) || null;
        }
        if (args?.include?.items) {
          res.items = store.purchaseOrderItems
            .filter((it) => it.purchaseOrderId === id)
            .map((it) => {
              const itClone = deepClone(it);
              if (args.include.items?.include?.product) {
                itClone.product = store.products.find((p) => p.id === it.productId) || null;
              }
              return itClone;
            });
        }
        return res;
      },
      async update(args: any) {
        const idx = store.purchaseOrders.findIndex((item) => matchesWhere(item, args.where));
        if (idx === -1) throw new Error('PurchaseOrder not found');
        store.purchaseOrders[idx] = { ...store.purchaseOrders[idx], ...args.data, updatedAt: new Date() };
        const res = deepClone(store.purchaseOrders[idx]);
        if (args?.include?.supplier) {
          res.supplier = store.suppliers.find((s) => s.id === res.supplierId) || null;
        }
        return res;
      },
    },

    purchaseOrderItem: {
      async findMany(args?: any) {
        const list = store.purchaseOrderItems.filter((item) => matchesWhere(item, args?.where));
        return deepClone(list);
      },
      async create(args: any) {
        const newItem = {
          id: genId('poi'),
          ...args.data,
        };
        store.purchaseOrderItems.push(newItem);
        return deepClone(newItem);
      },
      async createMany(args: any) {
        const items = args.data.map((d: any) => ({
          id: genId('poi'),
          ...d,
        }));
        store.purchaseOrderItems.push(...items);
        return { count: items.length };
      },
      async update(args: any) {
        const idx = store.purchaseOrderItems.findIndex((item) => matchesWhere(item, args.where));
        if (idx === -1) throw new Error('PurchaseOrderItem not found');
        store.purchaseOrderItems[idx] = { ...store.purchaseOrderItems[idx], ...args.data };
        return deepClone(store.purchaseOrderItems[idx]);
      },
    },

    sale: {
      async findMany(args?: any) {
        let list = store.sales.filter((item) => matchesWhere(item, args?.where));
        return list.map((s) => {
          const res = deepClone(s);
          if (args?.include?.items) {
            res.items = store.saleItems
              .filter((it) => it.saleId === s.id)
              .map((it) => {
                const itClone = deepClone(it);
                if (args.include.items?.include?.product) {
                  itClone.product = store.products.find((p) => p.id === it.productId) || null;
                }
                return itClone;
              });
          }
          return res;
        });
      },
      async create(args: any) {
        const newSale = {
          id: genId('sale'),
          ...args.data,
          createdAt: args.data.createdAt || new Date(),
        };
        store.sales.unshift(newSale);
        return deepClone(newSale);
      },
      async aggregate(_args?: any) {
        const totalRev = store.sales.reduce((acc, curr) => acc + (curr.total || 0), 0);
        return { _sum: { total: toDecimal(totalRev) } };
      },
    },

    saleItem: {
      async createMany(args: any) {
        const items = args.data.map((d: any) => ({
          id: genId('si'),
          ...d,
        }));
        store.saleItems.push(...items);
        return { count: items.length };
      },
      async findMany(args?: any) {
        return deepClone(store.saleItems.filter((item) => matchesWhere(item, args?.where)));
      },
    },

    receiver: {
      async findFirst(args?: any) {
        const r = store.receivers.find((item) => matchesWhere(item, args?.where));
        return r ? deepClone(r) : null;
      },
      async findMany(args?: any) {
        return deepClone(store.receivers.filter((item) => matchesWhere(item, args?.where)));
      },
      async findUnique(args: any) {
        const r = store.receivers.find((item) => matchesWhere(item, args.where));
        return r ? deepClone(r) : null;
      },
      async create(args: any) {
        const newRec = {
          id: genId('rec'),
          ...args.data,
          createdAt: new Date(),
        };
        store.receivers.push(newRec);
        return deepClone(newRec);
      },
    },

    supplier: {
      async findFirst(args?: any) {
        const s = store.suppliers.find((item) => matchesWhere(item, args?.where));
        return s ? deepClone(s) : null;
      },
      async findMany(args?: any) {
        return deepClone(store.suppliers.filter((item) => matchesWhere(item, args?.where)));
      },
      async findUnique(args: any) {
        const s = store.suppliers.find((item) => matchesWhere(item, args.where));
        return s ? deepClone(s) : null;
      },
      async create(args: any) {
        const newSup = {
          id: genId('sup'),
          ...args.data,
          createdAt: new Date(),
        };
        store.suppliers.push(newSup);
        return deepClone(newSup);
      },
    },

    async $transaction(cbOrList: any) {
      if (typeof cbOrList === 'function') {
        return cbOrList(this);
      }
      if (Array.isArray(cbOrList)) {
        return Promise.all(cbOrList);
      }
      return cbOrList;
    },
  };
}
