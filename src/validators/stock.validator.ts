import { z } from 'zod';

export const stockAdjustmentSchema = z
  .object({
    productId: z
      .string({ required_error: 'Produk wajib dipilih', invalid_type_error: 'ID produk tidak valid' })
      .min(1, 'ID produk tidak valid'),
    // Mode A: Physical count (Stock Opname)
    newQty: z
      .number({ invalid_type_error: 'Jumlah stok baru harus angka' })
      .int('Jumlah stok harus bilangan bulat')
      .min(0, 'Penyesuaian stok ditolak: stok tidak boleh negatif (minimal 0)')
      .optional(),
    oldQty: z
      .number({ invalid_type_error: 'Jumlah stok lama harus angka' })
      .int('Jumlah stok harus bilangan bulat')
      .min(0, 'Stok lama tidak boleh negatif')
      .optional(),
    // Mode B: Relative adjustment (IN / OUT)
    type: z.enum(['IN', 'OUT']).optional(),
    quantity: z
      .number({ invalid_type_error: 'Jumlah penyesuaian harus angka' })
      .int('Jumlah harus bilangan bulat')
      .min(1, 'Jumlah penyesuaian minimal 1')
      .max(1_000_000, 'Jumlah terlalu besar')
      .optional(),
    // Required fields: person who counted & documented reason
    person: z
      .string({ required_error: 'Nama petugas yang menghitung wajib diisi' })
      .trim()
      .min(1, 'Nama petugas yang menghitung wajib diisi'),
    reason: z
      .string({ required_error: 'Alasan penyesuaian stok wajib diisi' })
      .trim()
      .min(1, 'Alasan penyesuaian stok wajib diisi'),
    note: z
      .string()
      .trim()
      .max(200, 'Catatan maksimal 200 karakter')
      .optional()
      .transform((value) => (value ? value : undefined)),
  })
  .refine(
    (data) => data.newQty !== undefined || (data.type !== undefined && data.quantity !== undefined),
    {
      message: 'Harus mengisi jumlah stok baru (newQty) atau jenis dan jumlah penyesuaian (type & quantity)',
    }
  );

export const listStockMovementsQuerySchema = z.object({
  productId: z.string().min(1, 'ID produk tidak valid').optional(),
});

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
export type ListStockMovementsFilter = z.infer<typeof listStockMovementsQuerySchema>;
