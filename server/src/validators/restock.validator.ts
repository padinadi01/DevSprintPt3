import { z } from 'zod';

const restockOrderItemSchema = z.object({
  productId: z.string().uuid('ID produk tidak valid'),
  quantityOrdered: z
    .number({ required_error: 'Jumlah wajib diisi' })
    .int('Jumlah harus bilangan bulat')
    .min(1, 'Jumlah harus lebih dari 0'),
  unitName: z.string().trim().min(1, 'Satuan wajib diisi').max(30),
  piecesPerUnit: z
    .number({ required_error: 'Konversi wajib diisi' })
    .int('Konversi harus bilangan bulat')
    .min(1, 'Konversi minimal 1'),
  purchasePrice: z
    .number({ required_error: 'Harga beli wajib diisi' })
    .int('Harga beli harus bilangan bulat')
    .min(0, 'Harga beli tidak boleh negatif'),
});

export const createRestockOrderSchema = z.object({
  supplierId: z.string().uuid('ID supplier tidak valid'),
  notes: z.string().trim().max(500).optional().transform((v) => (v ? v : undefined)),
  items: z.array(restockOrderItemSchema).min(1, 'Minimal 1 item'),
});

const receiptItemSchema = z.object({
  restockOrderItemId: z.string().uuid('ID item pesanan tidak valid'),
  quantityGood: z.number().int().min(0, 'Jumlah baik tidak boleh negatif'),
  quantityDamaged: z.number().int().min(0).default(0),
  quantityBonus: z.number().int().min(0).default(0),
  notes: z.string().trim().max(300).optional().transform((v) => (v ? v : undefined)),
});

export const createRestockReceiptSchema = z.object({
  idempotencyKey: z.string().trim().min(1, 'Idempotency key wajib diisi').max(100),
  notes: z.string().trim().max(500).optional().transform((v) => (v ? v : undefined)),
  items: z.array(receiptItemSchema).min(1, 'Minimal 1 item'),
});

export type CreateRestockOrderInput = z.infer<typeof createRestockOrderSchema>;
export type CreateRestockReceiptInput = z.infer<typeof createRestockReceiptSchema>;
