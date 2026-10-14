import 'dotenv/config';
import { PrismaClient, StockMovementType } from '@prisma/client';
import { formatDateKeyWib } from '../src/lib/dates';

const prisma = new PrismaClient();

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

interface ProductSeed {
  sku: string;
  name: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  initialStock: number;
}

// "Beras 5 kg" and "Garam Dapur" are never sold or adjusted in the seed data.
const productSeeds: ProductSeed[] = [
  { sku: 'MIE-001', name: 'Indomie Goreng', category: 'Makanan Instan', purchasePrice: 2800, sellingPrice: 3500, initialStock: 60 },
  { sku: 'MNM-001', name: 'Aqua 600 ml', category: 'Minuman', purchasePrice: 2300, sellingPrice: 3000, initialStock: 48 },
  { sku: 'MNM-002', name: 'Teh Botol', category: 'Minuman', purchasePrice: 3800, sellingPrice: 5000, initialStock: 24 },
  { sku: 'MNM-003', name: 'Kopi Sachet', category: 'Minuman', purchasePrice: 1100, sellingPrice: 1500, initialStock: 40 },
  { sku: 'SMB-001', name: 'Minyak Goreng 1L', category: 'Sembako', purchasePrice: 17500, sellingPrice: 19500, initialStock: 12 },
  { sku: 'SMB-002', name: 'Gula 1 kg', category: 'Sembako', purchasePrice: 15500, sellingPrice: 17500, initialStock: 8 },
  { sku: 'RT-001', name: 'Sabun Mandi', category: 'Kebutuhan Rumah Tangga', purchasePrice: 2800, sellingPrice: 3500, initialStock: 10 },
  { sku: 'SNK-001', name: 'Biskuit', category: 'Makanan Ringan', purchasePrice: 6500, sellingPrice: 8000, initialStock: 20 },
  { sku: 'SMB-003', name: 'Beras 5 kg', category: 'Sembako', purchasePrice: 62000, sellingPrice: 68000, initialStock: 3 },
  { sku: 'SMB-004', name: 'Garam Dapur', category: 'Sembako', purchasePrice: 2500, sellingPrice: 3500, initialStock: 4 },
];

interface SeededProduct {
  id: string;
  sellingPrice: number;
  stock: number;
}

// Running view of each product while the history is replayed in chronological order.
const seeded = new Map<string, SeededProduct>();

function getSeeded(sku: string): SeededProduct {
  const product = seeded.get(sku);
  if (!product) throw new Error(`Unknown SKU in seed data: ${sku}`);
  return product;
}

async function clearDatabase(): Promise<void> {
  await prisma.saleItem.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.product.deleteMany();
}

async function seedProducts(): Promise<void> {
  const createdAt = daysAgo(7);
  for (const seed of productSeeds) {
    const product = await prisma.product.create({
      data: {
        sku: seed.sku,
        name: seed.name,
        category: seed.category,
        purchasePrice: seed.purchasePrice,
        sellingPrice: seed.sellingPrice,
        stock: seed.initialStock,
        createdAt,
      },
    });
    await prisma.stockMovement.create({
      data: {
        productId: product.id,
        type: StockMovementType.INITIAL,
        quantity: seed.initialStock,
        beforeStock: 0,
        afterStock: seed.initialStock,
        note: 'Stok awal',
        createdAt,
      },
    });
    seeded.set(seed.sku, { id: product.id, sellingPrice: seed.sellingPrice, stock: seed.initialStock });
  }
}

async function seedSale(createdAt: Date, lines: Array<[sku: string, quantity: number]>): Promise<void> {
  const invoiceNumber = `INV-${formatDateKeyWib(createdAt)}-0001`;
  const items = lines.map(([sku, quantity]) => {
    const product = getSeeded(sku);
    return { sku, product, quantity, subtotal: product.sellingPrice * quantity };
  });
  const total = items.reduce((sum, item) => sum + item.subtotal, 0);

  const sale = await prisma.sale.create({
    data: {
      invoiceNumber,
      total,
      createdAt,
      items: {
        create: items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.product.sellingPrice,
          subtotal: item.subtotal,
        })),
      },
    },
  });

  for (const item of items) {
    const beforeStock = item.product.stock;
    const afterStock = beforeStock - item.quantity;
    item.product.stock = afterStock;
    await prisma.stockMovement.create({
      data: {
        productId: item.product.id,
        type: StockMovementType.SALE,
        quantity: item.quantity,
        beforeStock,
        afterStock,
        referenceType: 'SALE',
        referenceId: sale.id,
        createdAt,
      },
    });
  }
}

async function seedAdjustmentOut(createdAt: Date, sku: string, quantity: number, note: string): Promise<void> {
  const product = getSeeded(sku);
  const beforeStock = product.stock;
  const afterStock = beforeStock - quantity;
  product.stock = afterStock;
  await prisma.stockMovement.create({
    data: {
      productId: product.id,
      type: StockMovementType.ADJUSTMENT_OUT,
      quantity,
      beforeStock,
      afterStock,
      note,
      createdAt,
    },
  });
}

async function syncProductStock(): Promise<void> {
  for (const product of seeded.values()) {
    await prisma.product.update({ where: { id: product.id }, data: { stock: product.stock } });
  }
}

async function main(): Promise<void> {
  await clearDatabase();
  await seedProducts();

  // History is replayed oldest to newest so beforeStock / afterStock stay consistent.
  await seedSale(daysAgo(3), [['MIE-001', 10], ['MNM-001', 6], ['MNM-003', 10]]);
  await seedAdjustmentOut(daysAgo(2.5), 'MNM-001', 2, 'Barang rusak (kemasan bocor)');
  await seedSale(daysAgo(2), [['SMB-001', 2], ['SMB-002', 3], ['MNM-002', 4]]);
  await seedSale(daysAgo(1), [['MIE-001', 15], ['SNK-001', 5], ['RT-001', 4]]);
  await seedSale(new Date(Date.now() - 15 * 60 * 1000), [['MNM-001', 4], ['MNM-002', 6], ['RT-001', 2], ['MNM-003', 5]]);

  await syncProductStock();

  const [products, sales, movements] = await Promise.all([
    prisma.product.count(),
    prisma.sale.count(),
    prisma.stockMovement.count(),
  ]);
  console.log(`Seed selesai: ${products} produk, ${sales} penjualan, ${movements} pergerakan stok.`);
}

main()
  .catch((error: unknown) => {
    console.error('Seed gagal:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
