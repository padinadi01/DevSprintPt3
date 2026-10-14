"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPurchaseOrderSchema = exports.purchaseOrderItemSchema = void 0;
const zod_1 = require("zod");
exports.purchaseOrderItemSchema = zod_1.z.object({
    productId: zod_1.z
        .string({ required_error: 'Produk wajib dipilih', invalid_type_error: 'ID produk tidak valid' })
        .uuid('ID produk tidak valid'),
    orderedQty: zod_1.z
        .number({ required_error: 'Jumlah pesan wajib diisi', invalid_type_error: 'Jumlah harus berupa angka' })
        .int('Jumlah harus bilangan bulat')
        .min(1, 'Jumlah minimal 1'),
});
exports.createPurchaseOrderSchema = zod_1.z.object({
    supplierId: zod_1.z
        .string({ required_error: 'Supplier wajib dipilih', invalid_type_error: 'ID supplier tidak valid' })
        .uuid('ID supplier tidak valid'),
    orderDate: zod_1.z
        .string({ required_error: 'Tanggal pesanan wajib diisi' })
        .datetime({ message: 'Format tanggal tidak valid (harus ISO 8601)' }),
    note: zod_1.z
        .string()
        .trim()
        .max(500, 'Catatan maksimal 500 karakter')
        .optional()
        .transform((val) => (val ? val : undefined)),
    items: zod_1.z
        .array(exports.purchaseOrderItemSchema)
        .min(1, 'Pesanan minimal harus memiliki 1 produk'),
});
