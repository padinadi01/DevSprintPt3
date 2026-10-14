"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatStockBreakdown = formatStockBreakdown;
exports.toProductDto = toProductDto;
exports.listProducts = listProducts;
exports.getProduct = getProduct;
exports.createProduct = createProduct;
exports.updateProduct = updateProduct;
exports.setProductStatus = setProductStatus;
exports.deleteProduct = deleteProduct;
const client_1 = require("@prisma/client");
const constants_1 = require("../lib/constants");
const db_1 = require("../lib/db");
const errors_1 = require("../lib/errors");
const prisma_errors_1 = require("../lib/prisma-errors");
const PRODUCT_NOT_FOUND = 'Produk tidak ditemukan.';
const SKU_ALREADY_USED = 'SKU sudah digunakan oleh produk lain.';
function formatStockBreakdown(stock, unitsPerPurchase, unitOfPurchase, baseUnit) {
    if (unitsPerPurchase <= 1) {
        return `${stock} ${baseUnit}`;
    }
    const purchaseUnits = Math.floor(stock / unitsPerPurchase);
    const looseUnits = stock % unitsPerPurchase;
    if (purchaseUnits === 0) {
        return `${stock} ${baseUnit}`;
    }
    if (looseUnits === 0) {
        return `${stock} ${baseUnit} = ${purchaseUnits} ${unitOfPurchase}`;
    }
    return `${stock} ${baseUnit} = ${purchaseUnits} ${unitOfPurchase} + ${looseUnits} ${baseUnit}`;
}
function toProductDto(product) {
    return {
        id: product.id,
        sku: product.sku,
        name: product.name,
        category: product.category,
        purchasePrice: product.purchasePrice.toNumber(),
        sellingPrice: product.sellingPrice.toNumber(),
        stock: product.stock,
        isActive: product.isActive,
        unitOfPurchase: product.unitOfPurchase,
        unitsPerPurchase: product.unitsPerPurchase,
        baseUnit: product.baseUnit,
        stockBreakdown: formatStockBreakdown(product.stock, product.unitsPerPurchase, product.unitOfPurchase, product.baseUnit),
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
    };
}
async function listProducts(filter = {}) {
    const where = {};
    if (filter.search) {
        where.OR = [
            { name: { contains: filter.search, mode: 'insensitive' } },
            { sku: { contains: filter.search, mode: 'insensitive' } },
            { category: { contains: filter.search, mode: 'insensitive' } },
        ];
    }
    if (filter.inStock) {
        where.stock = { gt: 0 };
        where.isActive = true;
    }
    const products = await db_1.db.product.findMany({ where, orderBy: { name: 'asc' } });
    return products.map(toProductDto);
}
async function getProduct(id) {
    const product = await db_1.db.product.findUnique({ where: { id } });
    if (!product)
        throw new errors_1.NotFoundError(PRODUCT_NOT_FOUND);
    return toProductDto(product);
}
async function createProduct(input) {
    try {
        const product = await db_1.db.$transaction(async (tx) => {
            const created = await tx.product.create({
                data: {
                    sku: input.sku,
                    name: input.name,
                    category: input.category,
                    purchasePrice: input.purchasePrice,
                    sellingPrice: input.sellingPrice,
                    stock: input.stock,
                },
            });
            // Every unit of stock must be explainable by the stock history, including the first ones.
            if (created.stock > 0) {
                await tx.stockMovement.create({
                    data: {
                        productId: created.id,
                        type: client_1.StockMovementType.INITIAL,
                        quantity: created.stock,
                        beforeStock: 0,
                        afterStock: created.stock,
                        note: 'Stok awal',
                    },
                });
            }
            return created;
        });
        return toProductDto(product);
    }
    catch (error) {
        if ((0, prisma_errors_1.hasPrismaCode)(error, 'P2002'))
            throw new errors_1.ConflictError(SKU_ALREADY_USED);
        throw error;
    }
}
async function updateProduct(id, input) {
    try {
        const product = await db_1.db.product.update({ where: { id }, data: input });
        return toProductDto(product);
    }
    catch (error) {
        if ((0, prisma_errors_1.hasPrismaCode)(error, 'P2025'))
            throw new errors_1.NotFoundError(PRODUCT_NOT_FOUND);
        if ((0, prisma_errors_1.hasPrismaCode)(error, 'P2002'))
            throw new errors_1.ConflictError(SKU_ALREADY_USED);
        throw error;
    }
}
async function setProductStatus(id, input) {
    try {
        const product = await db_1.db.product.update({
            where: { id },
            data: { isActive: input.isActive },
        });
        return toProductDto(product);
    }
    catch (error) {
        if ((0, prisma_errors_1.hasPrismaCode)(error, 'P2025'))
            throw new errors_1.NotFoundError(PRODUCT_NOT_FOUND);
        throw error;
    }
}
// Hard delete. A product can only be removed while nothing but its own initial stock entry refers
// to it. The foreign keys in PostgreSQL (ON DELETE RESTRICT) are the final guard; the checks below
// exist to give the owner a clear message.
async function deleteProduct(id) {
    const product = await db_1.db.product.findUnique({ where: { id }, select: { id: true } });
    if (!product)
        throw new errors_1.NotFoundError(PRODUCT_NOT_FOUND);
    const saleItemCount = await db_1.db.saleItem.count({ where: { productId: id } });
    if (saleItemCount > 0)
        throw new errors_1.ConflictError(constants_1.PRODUCT_IN_TRANSACTION_MESSAGE);
    const otherMovementCount = await db_1.db.stockMovement.count({
        where: { productId: id, type: { not: client_1.StockMovementType.INITIAL } },
    });
    if (otherMovementCount > 0)
        throw new errors_1.ConflictError(constants_1.PRODUCT_HAS_STOCK_HISTORY_MESSAGE);
    try {
        await db_1.db.$transaction([
            db_1.db.stockMovement.deleteMany({ where: { productId: id, type: client_1.StockMovementType.INITIAL } }),
            db_1.db.product.delete({ where: { id } }),
        ]);
    }
    catch (error) {
        // Someone referenced the product between the checks above and the delete.
        if ((0, prisma_errors_1.hasPrismaCode)(error, 'P2003'))
            throw new errors_1.ConflictError(constants_1.PRODUCT_IN_TRANSACTION_MESSAGE);
        if ((0, prisma_errors_1.hasPrismaCode)(error, 'P2025'))
            throw new errors_1.NotFoundError(PRODUCT_NOT_FOUND);
        throw error;
    }
}
