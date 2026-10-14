import type { Request } from 'express';

export const permissionCatalog = [
  { key: 'dashboard.view', label: 'Lihat dashboard dan ringkasan toko' },
  { key: 'products.view', label: 'Lihat daftar dan detail produk' },
  { key: 'products.manage', label: 'Tambah, ubah, dan hapus produk/harga jual' },
  { key: 'product.cost.view', label: 'Lihat dan mengubah harga modal' },
  { key: 'sales.view.all', label: 'Lihat semua riwayat penjualan' },
  { key: 'sales.view.own', label: 'Lihat penjualan atas nama sendiri' },
  { key: 'sales.create', label: 'Mencatat penjualan' },
  { key: 'suppliers.view', label: 'Lihat data supplier' },
  { key: 'suppliers.manage', label: 'Tambah supplier' },
  { key: 'restock.view', label: 'Lihat pesanan dan penerimaan restock' },
  { key: 'restock.create', label: 'Membuat pesanan restock' },
  { key: 'restock.cancel', label: 'Membatalkan pesanan restock' },
  { key: 'restock.receive', label: 'Mencatat penerimaan barang' },
  { key: 'inventory.view', label: 'Lihat riwayat stok opname' },
  { key: 'inventory.create', label: 'Membuat dan menerapkan stok opname' },
  { key: 'stock.view', label: 'Lihat riwayat pergerakan stok' },
  { key: 'stock.adjust', label: 'Menambah atau mengurangi stok' },
] as const;

export type PermissionKey = (typeof permissionCatalog)[number]['key'];

interface RouteRule {
  method: string;
  pattern: RegExp;
  permissions: PermissionKey[];
}

const rules: RouteRule[] = [
  { method: 'GET', pattern: /^\/api\/auth\/session$/, permissions: [] },
  { method: 'GET', pattern: /^\/api\/access\/users$/, permissions: [] },
  { method: 'POST', pattern: /^\/api\/access\/users$/, permissions: [] },
  { method: 'PATCH', pattern: /^\/api\/access\/users\/[^/]+$/, permissions: [] },
  { method: 'PATCH', pattern: /^\/api\/access\/users\/[^/]+\/pin$/, permissions: [] },
  { method: 'GET', pattern: /^\/api\/access\/roles$/, permissions: [] },
  { method: 'POST', pattern: /^\/api\/access\/roles$/, permissions: [] },
  { method: 'PATCH', pattern: /^\/api\/access\/roles\/[^/]+$/, permissions: [] },
  { method: 'DELETE', pattern: /^\/api\/access\/roles\/[^/]+$/, permissions: [] },
  { method: 'GET', pattern: /^\/api\/access\/permissions$/, permissions: [] },
  { method: 'GET', pattern: /^\/api\/dashboard$/, permissions: ['dashboard.view'] },
  { method: 'GET', pattern: /^\/api\/products(?:\/[^/]+)?$/, permissions: ['products.view'] },
  { method: 'POST', pattern: /^\/api\/products$/, permissions: ['products.manage'] },
  { method: 'PATCH', pattern: /^\/api\/products\/[^/]+(?:\/status)?$/, permissions: ['products.manage'] },
  { method: 'DELETE', pattern: /^\/api\/products\/[^/]+$/, permissions: ['products.manage'] },
  { method: 'GET', pattern: /^\/api\/sales$/, permissions: ['sales.view.all', 'sales.view.own'] },
  { method: 'GET', pattern: /^\/api\/sales\/[^/]+$/, permissions: ['sales.view.all', 'sales.view.own'] },
  { method: 'POST', pattern: /^\/api\/sales$/, permissions: ['sales.create'] },
  { method: 'GET', pattern: /^\/api\/suppliers$/, permissions: ['suppliers.view'] },
  { method: 'POST', pattern: /^\/api\/suppliers$/, permissions: ['suppliers.manage'] },
  { method: 'GET', pattern: /^\/api\/restock-orders(?:\/[^/]+)?$/, permissions: ['restock.view'] },
  { method: 'POST', pattern: /^\/api\/restock-orders$/, permissions: ['restock.create'] },
  { method: 'PATCH', pattern: /^\/api\/restock-orders\/[^/]+\/cancel$/, permissions: ['restock.cancel'] },
  { method: 'POST', pattern: /^\/api\/restock-orders\/[^/]+\/receipts$/, permissions: ['restock.receive'] },
  { method: 'GET', pattern: /^\/api\/inventory-checks(?:\/[^/]+)?$/, permissions: ['inventory.view'] },
  { method: 'POST', pattern: /^\/api\/inventory-checks$/, permissions: ['inventory.create'] },
  { method: 'GET', pattern: /^\/api\/stock-movements$/, permissions: ['stock.view'] },
  { method: 'POST', pattern: /^\/api\/stock-adjustments$/, permissions: ['stock.adjust'] },
];

export function getRequiredPermissions(
  req: Pick<Request, 'originalUrl' | 'method' | 'body'>,
): PermissionKey[] | undefined {
  const path = req.originalUrl.split('?')[0];
  const rule = rules.find(
    (candidate) => candidate.method === req.method && candidate.pattern.test(path),
  );
  if (!rule) return undefined;

  const required = [...rule.permissions];
  const body = typeof req.body === 'object' && req.body !== null
    ? req.body as Record<string, unknown>
    : {};
  const containsPurchasePrice = (value: unknown): boolean =>
    typeof value === 'object' && value !== null && 'purchasePrice' in value;
  if (
    req.method !== 'GET' &&
    ((path === '/api/products' && 'purchasePrice' in body) ||
      (path === '/api/products' && req.method === 'POST') ||
      (path.startsWith('/api/restock-orders') &&
        path.endsWith('/receipts') === false &&
        Array.isArray(body.items) &&
        body.items.some(containsPurchasePrice)))
  ) {
    required.push('product.cost.view');
  }
  if (req.method === 'PATCH' && /^\/api\/products\/[^/]+$/.test(path)) {
    if ('purchasePrice' in body) required.push('product.cost.view');
  }
  return required;
}

export function hasPermissions(userPermissions: string[], required: string[]): boolean {
  return required.every((permission) => userPermissions.includes(permission));
}

export function resolveUserPermissions(
  usesRolePermissions: boolean,
  userPermissions: string[],
  rolePermissions: string[],
): string[] {
  return usesRolePermissions ? rolePermissions : userPermissions;
}

export function canReadSales(userPermissions: string[]): boolean {
  return userPermissions.includes('sales.view.all') || userPermissions.includes('sales.view.own');
}
