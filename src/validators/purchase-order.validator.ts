import { z } from 'zod';

export const purchaseOrderItemSchema = z.object({
  productId: z
    .string({ required_error: 'Produk wajib dipilih', invalid_type_error: 'ID produk tidak valid' })
    .min(1, 'ID produk tidak valid'),
  orderedQty: z
    .number({ required_error: 'Jumlah pesan wajib diisi', invalid_type_error: 'Jumlah harus berupa angka' })
    .int('Jumlah harus bilangan bulat')
    .min(1, 'Jumlah minimal 1'),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z
    .string({ required_error: 'Supplier wajib dipilih', invalid_type_error: 'ID supplier tidak valid' })
    .min(1, 'ID supplier tidak valid'),
  orderDate: z
    .string({ required_error: 'Tanggal pesanan wajib diisi' })
    .datetime({ message: 'Format tanggal tidak valid (harus ISO 8601)' }),
  note: z
    .string()
    .trim()
    .max(500, 'Catatan maksimal 500 karakter')
    .optional()
    .transform((val) => (val ? val : undefined)),
  items: z
    .array(purchaseOrderItemSchema)
    .min(1, 'Pesanan minimal harus memiliki 1 produk'),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
