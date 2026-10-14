import { z } from 'zod';

export const createSupplierSchema = z.object({
  name: z
    .string({ required_error: 'Nama supplier wajib diisi' })
    .trim()
    .min(1, 'Nama supplier wajib diisi')
    .max(120, 'Nama supplier maksimal 120 karakter'),
  phone: z
    .string()
    .trim()
    .max(30, 'Nomor telepon maksimal 30 karakter')
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
