import { z } from 'zod';

const inventoryCheckItemSchema = z.object({
  productId: z.string().uuid('ID produk tidak valid'),
  physicalStock: z
    .number({ required_error: 'Stok fisik wajib diisi' })
    .int('Stok fisik harus bilangan bulat')
    .min(0, 'Stok fisik tidak boleh negatif'),
  reason: z.string().trim().min(1, 'Alasan wajib diisi').max(200),
  notes: z.string().trim().max(300).optional().transform((v) => (v ? v : undefined)),
});

export const createInventoryCheckSchema = z.object({
  notes: z.string().trim().max(500).optional().transform((v) => (v ? v : undefined)),
  items: z.array(inventoryCheckItemSchema).min(1, 'Minimal 1 item'),
});

export type CreateInventoryCheckInput = z.infer<typeof createInventoryCheckSchema>;
