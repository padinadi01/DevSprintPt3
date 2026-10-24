import 'dotenv/config';
import { db } from '../src/lib/db';
import { createGoodsReceipt } from '../src/services/goods-receipt.service';
import { createPurchaseOrder } from '../src/services/purchase-order.service';
import crypto from 'crypto';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(msg);
  }
  console.log(`   ✅ ${msg}`);
}

async function main() {
  console.log('================================================================');
  console.log('UNIT TEST: GOODS RECEIPT STOCK LOGIC & VALIDATION');
  console.log('Formula: stok_masuk = qty_diterima - qty_ditolak + qty_bonus');
  console.log('================================================================\n');

  // Master data
  const supplier = await db.supplier.findFirst();
  const receiver = await db.receiver.findFirst();
  const product = await db.product.findFirst({ where: { sku: 'SMB-001' } });

  assert(!!supplier, 'Supplier exists');
  assert(!!receiver, 'Receiver exists');
  assert(!!product, 'Product SMB-001 exists');

  // ---------------------------------------------------------------------------
  // KASUS 1: diterima 2, ditolak 0, bonus 0 -> +2
  // ---------------------------------------------------------------------------
  console.log('\n--- KASUS 1: diterima 2, ditolak 0, bonus 0 -> +2 ---');
  const initialStock1 = (await db.product.findUnique({ where: { id: product!.id } }))!.stock;

  const po1 = await createPurchaseOrder({
    supplierId: supplier!.id,
    orderDate: new Date().toISOString(),
    items: [{ productId: product!.id, orderedQty: 5 }],
  });

  const receipt1 = await createGoodsReceipt({
    purchaseOrderId: po1.id,
    receiverId: receiver!.id,
    idempotencyKey: crypto.randomUUID(),
    items: [
      {
        productId: product!.id,
        receivedQty: 2,
        rejectedQty: 0,
        bonusQty: 0,
      },
    ],
  });

  const productAfter1 = await db.product.findUnique({ where: { id: product!.id } });
  const movements1 = await db.stockMovement.findMany({
    where: { referenceId: receipt1.id, referenceType: 'GOODS_RECEIPT' },
  });
  const movement1 = movements1[0];

  assert(productAfter1!.stock === initialStock1 + 2, `Stok bertambah tepat 2 (sebelum: ${initialStock1}, sesudah: ${productAfter1!.stock})`);
  assert(!!movement1, 'StockMovement dibuat');
  assert(movement1!.quantity === 2, `Movement quantity = 2 (actual: ${movement1!.quantity})`);
  assert(movement1!.beforeStock === initialStock1, `Movement beforeStock = ${initialStock1}`);
  assert(movement1!.afterStock === initialStock1 + 2, `Movement afterStock = ${initialStock1 + 2}`);
  assert(
    movement1!.note === 'Penerimaan barang: diterima 2 pcs, ditolak 0 pcs, bonus 0 pcs -> masuk 2 pcs',
    `Format note sesuai spesifikasi: "${movement1!.note}"`
  );

  // ---------------------------------------------------------------------------
  // KASUS 2: diterima 2, ditolak 2, bonus 1 -> +1
  // ---------------------------------------------------------------------------
  console.log('\n--- KASUS 2: diterima 2, ditolak 2, bonus 1 -> +1 ---');
  const initialStock2 = (await db.product.findUnique({ where: { id: product!.id } }))!.stock;

  const po2 = await createPurchaseOrder({
    supplierId: supplier!.id,
    orderDate: new Date().toISOString(),
    items: [{ productId: product!.id, orderedQty: 5 }],
  });

  const receipt2 = await createGoodsReceipt({
    purchaseOrderId: po2.id,
    receiverId: receiver!.id,
    idempotencyKey: crypto.randomUUID(),
    items: [
      {
        productId: product!.id,
        receivedQty: 2,
        rejectedQty: 2,
        rejectedReason: '2 botol bocor/pecah di jalan',
        bonusQty: 1,
      },
    ],
  });

  const productAfter2 = await db.product.findUnique({ where: { id: product!.id } });
  const movements2 = await db.stockMovement.findMany({
    where: { referenceId: receipt2.id, referenceType: 'GOODS_RECEIPT' },
  });
  const movement2 = movements2[0];

  assert(productAfter2!.stock === initialStock2 + 1, `Stok bertambah tepat 1 (sebelum: ${initialStock2}, sesudah: ${productAfter2!.stock})`);
  assert(!!movement2, 'StockMovement dibuat');
  assert(movement2!.quantity === 1, `Movement quantity = 1 (actual: ${movement2!.quantity})`);
  assert(movement2!.beforeStock === initialStock2, `Movement beforeStock = ${initialStock2}`);
  assert(movement2!.afterStock === initialStock2 + 1, `Movement afterStock = ${initialStock2 + 1}`);
  assert(
    movement2!.note === 'Penerimaan barang: diterima 2 pcs, ditolak 2 pcs, bonus 1 pcs -> masuk 1 pcs',
    `Format note sesuai spesifikasi: "${movement2!.note}"`
  );

  // ---------------------------------------------------------------------------
  // KASUS 3: diterima 4, ditolak 2, bonus 1 -> +3
  // ---------------------------------------------------------------------------
  console.log('\n--- KASUS 3: diterima 4, ditolak 2, bonus 1 -> +3 ---');
  const initialStock3 = (await db.product.findUnique({ where: { id: product!.id } }))!.stock;

  const po3 = await createPurchaseOrder({
    supplierId: supplier!.id,
    orderDate: new Date().toISOString(),
    items: [{ productId: product!.id, orderedQty: 5 }],
  });

  const receipt3 = await createGoodsReceipt({
    purchaseOrderId: po3.id,
    receiverId: receiver!.id,
    idempotencyKey: crypto.randomUUID(),
    items: [
      {
        productId: product!.id,
        receivedQty: 4,
        rejectedQty: 2,
        rejectedReason: '2 botol segel terbuka',
        bonusQty: 1,
      },
    ],
  });

  const productAfter3 = await db.product.findUnique({ where: { id: product!.id } });
  const movements3 = await db.stockMovement.findMany({
    where: { referenceId: receipt3.id, referenceType: 'GOODS_RECEIPT' },
  });
  const movement3 = movements3[0];

  assert(productAfter3!.stock === initialStock3 + 3, `Stok bertambah tepat 3 (sebelum: ${initialStock3}, sesudah: ${productAfter3!.stock})`);
  assert(!!movement3, 'StockMovement dibuat');
  assert(movement3!.quantity === 3, `Movement quantity = 3 (actual: ${movement3!.quantity})`);
  assert(movement3!.beforeStock === initialStock3, `Movement beforeStock = ${initialStock3}`);
  assert(movement3!.afterStock === initialStock3 + 3, `Movement afterStock = ${initialStock3 + 3}`);
  assert(
    movement3!.note === 'Penerimaan barang: diterima 4 pcs, ditolak 2 pcs, bonus 1 pcs -> masuk 3 pcs',
    `Format note sesuai spesifikasi: "${movement3!.note}"`
  );

  // ---------------------------------------------------------------------------
  // KASUS 4: ditolak > diterima -> error validasi
  // ---------------------------------------------------------------------------
  console.log('\n--- KASUS 4: ditolak > diterima -> error validasi ---');
  let rejectedGreaterThanReceivedErrorThrown = false;
  try {
    await createGoodsReceipt({
      purchaseOrderId: po3.id,
      receiverId: receiver!.id,
      idempotencyKey: crypto.randomUUID(),
      items: [
        {
          productId: product!.id,
          receivedQty: 2,
          rejectedQty: 3,
          rejectedReason: 'Tolak lebih banyak dari barang datang',
          bonusQty: 0,
        },
      ],
    });
  } catch (err: any) {
    rejectedGreaterThanReceivedErrorThrown = true;
    console.log(`   Terkonfirmasi ditolak dengan error: "${err.message}"`);
    assert(
      err.message.includes('tidak boleh lebih besar dari jumlah diterima'),
      'Pesan error validasi sesuai aturan bisnis'
    );
  }
  assert(rejectedGreaterThanReceivedErrorThrown, 'Error validasi berhasil dilemparkan saat ditolak > diterima');

  console.log('\n================================================================');
  console.log('🎉 ALL 4 TEST CASES + VALIDATIONS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
