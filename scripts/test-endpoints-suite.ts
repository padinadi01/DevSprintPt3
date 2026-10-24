import 'dotenv/config';
import http from 'http';
import { app } from '../src/app';
import { db } from '../src/lib/db';
import { loginWithPin } from '../src/services/auth.service';
import { listProducts } from '../src/services/product.service';
import { listStockMovements } from '../src/services/stock.service';
import { listPurchaseOrders, getPurchaseOrder } from '../src/services/purchase-order.service';
import { getDashboard } from '../src/services/dashboard.service';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(msg);
  }
  console.log(`   ✅ ${msg}`);
}

async function main() {
  console.log('================================================================');
  console.log('TEST SUITE: FIXED SERVICES & ENDPOINTS (RESILIENCE & CONSISTENCY)');
  console.log('================================================================\n');

  // 1. Direct Service Layer Tests
  console.log('--- 1. DIRECT SERVICE LAYER TESTS ---');
  const products = await listProducts();
  assert(Array.isArray(products) && products.length > 0, `listProducts returns ${products.length} products`);

  const movements = await listStockMovements({});
  assert(Array.isArray(movements) && movements.length > 0, `listStockMovements returns ${movements.length} movements`);

  const pos = await listPurchaseOrders();
  assert(Array.isArray(pos) && pos.length > 0, `listPurchaseOrders returns ${pos.length} purchase orders`);
  assert(typeof pos[0].orderDate === 'string' && pos[0].orderDate.length > 0, 'PO has valid ISO orderDate');
  assert(typeof pos[0].supplierName === 'string' && pos[0].supplierName.length > 0, 'PO has valid supplierName');

  const poDetail = await getPurchaseOrder(pos[0].id);
  assert(poDetail.id === pos[0].id, 'getPurchaseOrder loads detail matching ID');
  assert(Array.isArray(poDetail.items) && poDetail.items.length > 0, 'PO Detail has items array');

  const dashboard = await getDashboard();
  assert(typeof dashboard.totalProducts === 'number', 'Dashboard totalProducts is a number');
  assert(typeof dashboard.totalUnits === 'number', 'Dashboard totalUnits is a number');
  assert(typeof dashboard.todaySalesTotal === 'number', 'Dashboard todaySalesTotal is a number');

  // 2. Stock Numbers Consistency Verification
  console.log('\n--- 2. STOCK NUMBERS & AUDIT TRAIL CONSISTENCY ---');
  let calculatedTotalUnits = 0;
  for (const p of products) {
    calculatedTotalUnits += p.stock;
    const prodMovements = movements.filter((m) => m.productId === p.id);
    assert(prodMovements.length > 0, `Produk ${p.sku} (${p.name}) memiliki riwayat pergerakan stok`);

    // Verify latest movement afterStock matches product current stock
    const latestMovement = prodMovements[0]; // sorted desc
    assert(
      latestMovement.afterStock === p.stock,
      `Stok produk ${p.sku} (${p.stock}) cocok dengan afterStock mutasi terakhir (${latestMovement.afterStock})`
    );
  }

  assert(dashboard.totalProducts === products.length, `Dashboard totalProducts (${dashboard.totalProducts}) cocok dengan jumlah produk (${products.length})`);
  assert(dashboard.totalUnits === calculatedTotalUnits, `Dashboard totalUnits (${dashboard.totalUnits}) cocok dengan total sisa stok (${calculatedTotalUnits})`);

  // 3. HTTP Endpoints Verification (both route paths)
  console.log('\n--- 3. HTTP ENDPOINTS & ROUTING TESTS ---');
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    const { token } = await loginWithPin('pemilik', '1234');
    const headers = { Authorization: `Bearer ${token}` };

    // Test GET /api/products
    const prodRes = await fetch(`${baseUrl}/products`, { headers });
    assert(prodRes.status === 200, 'GET /api/products returns HTTP 200');
    const prodData = (await prodRes.json()) as any[];
    assert(Array.isArray(prodData) && prodData.length > 0, 'GET /api/products returns array of products');

    // Test GET /api/stock-movements
    const stockMov1 = await fetch(`${baseUrl}/stock-movements`, { headers });
    assert(stockMov1.status === 200, 'GET /api/stock-movements returns HTTP 200');

    // Test GET /api/stock/movements (with slash)
    const stockMov2 = await fetch(`${baseUrl}/stock/movements`, { headers });
    assert(stockMov2.status === 200, 'GET /api/stock/movements returns HTTP 200');

    // Test query filter with productId
    const testProdId = products[0].id;
    const stockFiltered = await fetch(`${baseUrl}/stock-movements?productId=${testProdId}`, { headers });
    assert(stockFiltered.status === 200, `GET /api/stock-movements?productId=${testProdId} returns HTTP 200`);

    // Test GET /api/purchase-orders
    const poRes = await fetch(`${baseUrl}/purchase-orders`, { headers });
    assert(poRes.status === 200, 'GET /api/purchase-orders returns HTTP 200');
    const poData = (await poRes.json()) as any[];
    assert(Array.isArray(poData) && poData.length > 0, 'GET /api/purchase-orders returns array of POs');

    // Test GET /api/dashboard
    const dashRes = await fetch(`${baseUrl}/dashboard`, { headers });
    assert(dashRes.status === 200, 'GET /api/dashboard returns HTTP 200');
    const dashData = (await dashRes.json()) as any;
    assert(dashData.totalProducts === products.length, 'GET /api/dashboard data is valid');

    console.log('\n================================================================');
    console.log('🎉 ALL SERVICE, STOCK CONSISTENCY, & ENDPOINT TESTS PASSED!');
    console.log('================================================================\n');
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
