"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProductStatusSchema = exports.listProductsQuerySchema = exports.updateProductSchema = exports.createProductSchema = void 0;
const zod_1 = require("zod");
const MAX_PRICE = 999_999_999;
const MAX_STOCK = 1_000_000;
function requiredText(label, maxLength) {
    return zod_1.z
        .string({ required_error: `${label} wajib diisi`, invalid_type_error: `${label} harus berupa teks` })
        .trim()
        .min(1, `${label} wajib diisi`)
        .max(maxLength, `${label} maksimal ${maxLength} karakter`);
}
// Rupiah has no minor unit in daily use, so prices are whole numbers.
function wholeNumber(label) {
    return zod_1.z
        .number({ required_error: `${label} wajib diisi`, invalid_type_error: `${label} harus berupa angka` })
        .int(`${label} harus berupa bilangan bulat`);
}
exports.createProductSchema = zod_1.z.object({
    sku: requiredText('SKU', 40),
    name: requiredText('Nama produk', 120),
    category: requiredText('Kategori', 60),
    purchasePrice: wholeNumber('Harga beli')
        .min(0, 'Harga beli tidak boleh negatif')
        .max(MAX_PRICE, 'Harga beli terlalu besar'),
    sellingPrice: wholeNumber('Harga jual')
        .min(1, 'Harga jual harus lebih dari 0')
        .max(MAX_PRICE, 'Harga jual terlalu besar'),
    stock: wholeNumber('Stok')
        .min(0, 'Stok tidak boleh negatif')
        .max(MAX_STOCK, 'Stok terlalu besar')
        .default(0),
});
// Stock is not editable here: it only changes through sales and stock adjustments.
exports.updateProductSchema = exports.createProductSchema
    .omit({ stock: true })
    .partial()
    .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Tidak ada data yang diubah',
});
exports.listProductsQuerySchema = zod_1.z.object({
    search: zod_1.z.string().trim().optional(),
    inStock: zod_1.z
        .enum(['true', 'false'])
        .optional()
        .transform((value) => value === 'true'),
});
exports.updateProductStatusSchema = zod_1.z.object({
    isActive: zod_1.z.boolean({
        required_error: 'Status aktif wajib diisi',
        invalid_type_error: 'Status aktif harus berupa boolean',
    }),
});
