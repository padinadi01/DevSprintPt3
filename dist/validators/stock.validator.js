"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listStockMovementsQuerySchema = exports.stockAdjustmentSchema = void 0;
const zod_1 = require("zod");
exports.stockAdjustmentSchema = zod_1.z
    .object({
    productId: zod_1.z
        .string({ required_error: 'Produk wajib dipilih', invalid_type_error: 'ID produk tidak valid' })
        .uuid('ID produk tidak valid'),
    // Mode A: Physical count (Stock Opname)
    newQty: zod_1.z
        .number({ invalid_type_error: 'Jumlah stok baru harus angka' })
        .int('Jumlah stok harus bilangan bulat')
        .min(0, 'Penyesuaian stok ditolak: stok tidak boleh negatif (minimal 0)')
        .optional(),
    oldQty: zod_1.z
        .number({ invalid_type_error: 'Jumlah stok lama harus angka' })
        .int('Jumlah stok harus bilangan bulat')
        .min(0, 'Stok lama tidak boleh negatif')
        .optional(),
    // Mode B: Relative adjustment (IN / OUT)
    type: zod_1.z.enum(['IN', 'OUT']).optional(),
    quantity: zod_1.z
        .number({ invalid_type_error: 'Jumlah penyesuaian harus angka' })
        .int('Jumlah harus bilangan bulat')
        .min(1, 'Jumlah penyesuaian minimal 1')
        .max(1_000_000, 'Jumlah terlalu besar')
        .optional(),
    // Required fields: person who counted & documented reason
    person: zod_1.z
        .string({ required_error: 'Nama petugas yang menghitung wajib diisi' })
        .trim()
        .min(1, 'Nama petugas yang menghitung wajib diisi'),
    reason: zod_1.z
        .string({ required_error: 'Alasan penyesuaian stok wajib diisi' })
        .trim()
        .min(1, 'Alasan penyesuaian stok wajib diisi'),
    note: zod_1.z
        .string()
        .trim()
        .max(200, 'Catatan maksimal 200 karakter')
        .optional()
        .transform((value) => (value ? value : undefined)),
})
    .refine((data) => data.newQty !== undefined || (data.type !== undefined && data.quantity !== undefined), {
    message: 'Harus mengisi jumlah stok baru (newQty) atau jenis dan jumlah penyesuaian (type & quantity)',
});
exports.listStockMovementsQuerySchema = zod_1.z.object({
    productId: zod_1.z.string().uuid('ID produk tidak valid').optional(),
});
