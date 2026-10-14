import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  hashPin,
  hashSessionToken,
  makeSessionToken,
  verifyPin,
} from './auth';
import {
  canReadSales,
  getRequiredPermissions,
  hasPermissions,
  resolveUserPermissions,
} from './permissions';
import { redactPurchasePrice } from './response';

test('PIN hash verifies only the original PIN and does not store the PIN value', async () => {
  const pinHash = await hashPin('123456');
  assert.notEqual(pinHash, '123456');
  assert.match(pinHash, /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
  assert.equal(await verifyPin('123456', pinHash), true);
  assert.equal(await verifyPin('654321', pinHash), false);
});

test('concurrent logins get independent opaque session tokens', () => {
  const first = makeSessionToken();
  const second = makeSessionToken();
  assert.notEqual(first, second);
  assert.notEqual(hashSessionToken(first), hashSessionToken(second));
});

test('individual permissions can override a role preset and return to inheritance', () => {
  const preset = ['products.view', 'restock.view'];
  const individual = ['products.view', 'products.manage'];
  assert.deepEqual(resolveUserPermissions(true, individual, preset), preset);
  assert.deepEqual(resolveUserPermissions(false, individual, preset), individual);
});

test('default staff permissions deny owner actions and cost visibility', () => {
  const staffPermissions = [
    'products.view',
    'restock.view',
    'restock.receive',
    'inventory.view',
    'stock.view',
  ];
  assert.equal(hasPermissions(staffPermissions, ['products.manage']), false);
  assert.equal(hasPermissions(staffPermissions, ['stock.adjust']), false);
  assert.equal(hasPermissions(staffPermissions, ['restock.cancel']), false);
  assert.equal(hasPermissions(staffPermissions, ['product.cost.view']), false);
  assert.equal(canReadSales(staffPermissions), false);
});

test('route permission lookup applies default-deny guards to mutation routes', () => {
  assert.deepEqual(
    getRequiredPermissions({ method: 'POST', originalUrl: '/api/stock-adjustments', body: {} }),
    ['stock.adjust'],
  );
  assert.deepEqual(
    getRequiredPermissions({ method: 'POST', originalUrl: '/api/products', body: {} }),
    ['products.manage', 'product.cost.view'],
  );
  assert.equal(
    getRequiredPermissions({ method: 'POST', originalUrl: '/api/not-a-route', body: {} }),
    undefined,
  );
});

test('RBAC matrix grants staff only approved read and receipt actions by default', () => {
  const staffPermissions = [
    'products.view',
    'restock.view',
    'restock.receive',
    'inventory.view',
    'stock.view',
  ];
  const matrix = [
    ['GET', '/api/products', {}, true],
    ['GET', '/api/stock-movements', {}, true],
    ['GET', '/api/restock-orders', {}, true],
    ['POST', '/api/restock-orders/123/receipts', {}, true],
    ['GET', '/api/inventory-checks', {}, true],
    ['GET', '/api/dashboard', {}, false],
    ['POST', '/api/sales', {}, false],
    ['POST', '/api/products', { purchasePrice: 1 }, false],
    ['POST', '/api/restock-orders', { items: [{ purchasePrice: 1 }] }, false],
    ['PATCH', '/api/restock-orders/123/cancel', {}, false],
    ['POST', '/api/stock-adjustments', {}, false],
    ['POST', '/api/inventory-checks', {}, false],
  ] as const;

  for (const [method, originalUrl, body, expected] of matrix) {
    const required = getRequiredPermissions({ method, originalUrl, body });
    const allowed = originalUrl.startsWith('/api/sales')
      ? canReadSales(staffPermissions)
      : required !== undefined && hasPermissions(staffPermissions, required);
    assert.equal(allowed, expected, `${method} ${originalUrl}`);
  }
});

test('purchase price is recursively removed from staff API response shapes', () => {
  assert.deepEqual(
    redactPurchasePrice({
      name: 'Produk',
      purchasePrice: 2500,
      items: [{ purchasePrice: 2000, quantity: 3 }],
    }),
    { name: 'Produk', items: [{ quantity: 3 }] },
  );
});
