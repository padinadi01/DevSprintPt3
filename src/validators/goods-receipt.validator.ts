import { z } from 'zod';

export const goodsReceiptItemInputSchema = z
  .object({
    productId: z
      .string({ required_error: 'Produk wajib dipilih' })
      .uuid('ID produk tidak valid'),
    receivedQty: z
      .number({ invalid_type_error: 'Jumlah diterima harus angka' })
      .int('Jumlah diterima harus bilangan bulat')
      .min(0, 'Jumlah diterima tidak boleh negatif')
      .optional(),
    goodQty: z
      .number({ invalid_type_error: 'Jumlah barang diterima/bagus harus angka' })
      .int('Jumlah barang diterima/bagus harus bilangan bulat')
      .min(0, 'Jumlah barang diterima/bagus tidak boleh negatif')
      .optional(),
    receivedBaseQty: z
      .number({ invalid_type_error: 'Jumlah diterima satuan kecil harus angka' })
      .int('Jumlah diterima satuan kecil harus bilangan bulat')
      .min(0, 'Jumlah diterima satuan kecil tidak boleh negatif')
      .optional(),
    goodBaseQty: z
      .number({ invalid_type_error: 'Jumlah barang diterima satuan kecil harus angka' })
      .int('Jumlah barang diterima satuan kecil harus bilangan bulat')
      .min(0, 'Jumlah barang diterima satuan kecil tidak boleh negatif')
      .optional(),
    bonusQty: z
      .number({ invalid_type_error: 'Jumlah bonus harus angka' })
      .int('Jumlah bonus harus bilangan bulat')
      .min(0, 'Jumlah bonus tidak boleh negatif')
      .optional()
      .default(0),
    bonusBaseQty: z
      .number({ invalid_type_error: 'Jumlah bonus satuan kecil harus angka' })
      .int('Jumlah bonus satuan kecil harus bilangan bulat')
      .min(0, 'Jumlah bonus satuan kecil tidak boleh negatif')
      .optional()
      .default(0),
    rejectedQty: z
      .number({ invalid_type_error: 'Jumlah tolak harus angka' })
      .int('Jumlah tolak harus bilangan bulat')
      .min(0, 'Jumlah tolak tidak boleh negatif')
      .optional()
      .default(0),
    rejectedBaseQty: z
      .number({ invalid_type_error: 'Jumlah tolak satuan jual harus angka' })
      .int('Jumlah tolak satuan jual harus bilangan bulat')
      .min(0, 'Jumlah tolak satuan jual tidak boleh negatif')
      .optional()
      .default(0),
    rejectedReason: z
      .string()
      .trim()
      .max(255, 'Alasan tolak maksimal 255 karakter')
      .optional()
      .transform((val) => (val ? val : undefined)),
    unitCostPerPurchaseUnit: z
      .number({ invalid_type_error: 'Harga beli harus angka' })
      .min(0, 'Harga beli tidak boleh negatif')
      .optional(),
    spreadBonusCost: z
      .boolean({ invalid_type_error: 'spreadBonusCost harus boolean' })
      .optional(),
  })
  .refine(
    (data) => {
      const received = data.receivedQty ?? data.goodQty ?? 0;
      const receivedBase = data.receivedBaseQty ?? data.goodBaseQty ?? 0;
      const bonus = data.bonusQty || 0;
      const bonusBase = data.bonusBaseQty || 0;
      const rejected = data.rejectedQty || 0;
      const rejectedBase = data.rejectedBaseQty || 0;
      return (received + receivedBase + bonus + bonusBase + rejected + rejectedBase) > 0;
    },
    {
      message: 'Total jumlah barang (diterima, bonus, atau ditolak) harus lebih dari 0',
    }
  )
  .refine(
    (data) => {
      if (data.receivedQty !== undefined) {
        const rejected = data.rejectedQty || 0;
        return rejected <= data.receivedQty;
      }
      return true;
    },
    {
      message: 'Jumlah ditolak tidak boleh lebih besar dari jumlah diterima',
      path: ['rejectedQty'],
    }
  )
  .refine(
    (data) => {
      if (data.receivedBaseQty !== undefined) {
        const rejectedBase = data.rejectedBaseQty || 0;
        return rejectedBase <= data.receivedBaseQty;
      }
      return true;
    },
    {
      message: 'Jumlah ditolak satuan kecil tidak boleh lebih besar dari jumlah diterima',
      path: ['rejectedBaseQty'],
    }
  )
  .refine(
    (data) =>
      ((data.rejectedQty || 0) === 0 && (data.rejectedBaseQty || 0) === 0) ||
      (!!data.rejectedReason && data.rejectedReason.length > 0),
    {
      message: 'Alasan tolak/rusak wajib diisi jika ada barang yang ditolak',
      path: ['rejectedReason'],
    }
  );

export const createGoodsReceiptSchema = z.object({
  purchaseOrderId: z
    .string()
    .uuid('ID Purchase Order tidak valid')
    .optional(),
  supplierId: z
    .string()
    .uuid('ID Supplier tidak valid')
    .optional(),
  receiverId: z
    .string({ required_error: 'Penerima wajib dipilih' })
    .uuid('ID penerima tidak valid'),
  receivedAt: z
    .string()
    .datetime({ message: 'Format tanggal penerimaan harus ISO 8601' })
    .optional(),
  idempotencyKey: z
    .string({ required_error: 'Idempotency key wajib disertakan' })
    .min(1, 'Idempotency key tidak boleh kosong'),
  note: z
    .string()
    .trim()
    .max(500, 'Catatan maksimal 500 karakter')
    .optional()
    .transform((val) => (val ? val : undefined)),
  completeOrder: z
    .boolean({ invalid_type_error: 'completeOrder harus boolean' })
    .optional(),
  items: z
    .array(goodsReceiptItemInputSchema)
    .min(1, 'Penerimaan harus memiliki minimal 1 item barang'),
});

export const reverseGoodsReceiptSchema = z.object({
  reason: z
    .string({ required_error: 'Alasan pembatalan wajib diisi' })
    .trim()
    .min(1, 'Alasan pembatalan tidak boleh kosong')
    .max(255, 'Alasan pembatalan maksimal 255 karakter'),
  person: z
    .string({ required_error: 'Nama petugas wajib diisi' })
    .trim()
    .min(1, 'Nama petugas tidak boleh kosong')
    .max(100, 'Nama petugas maksimal 100 karakter'),
});

export interface GoodsReceiptItemInput {
  productId: string;
  receivedQty?: number;
  goodQty?: number;
  receivedBaseQty?: number;
  goodBaseQty?: number;
  bonusQty?: number;
  bonusBaseQty?: number;
  rejectedQty?: number;
  rejectedBaseQty?: number;
  rejectedReason?: string;
  unitCostPerPurchaseUnit?: number;
  spreadBonusCost?: boolean;
}

export interface CreateGoodsReceiptInput {
  purchaseOrderId?: string;
  supplierId?: string;
  receiverId: string;
  receivedAt?: string;
  idempotencyKey: string;
  note?: string;
  completeOrder?: boolean;
  items: GoodsReceiptItemInput[];
}

export interface ReverseGoodsReceiptInput {
  reason: string;
  person: string;
}
