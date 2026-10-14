-- Add baseUnit column to Product table
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "baseUnit" TEXT NOT NULL DEFAULT 'pcs';

-- Update base unit for common seed products
UPDATE "Product" SET "baseUnit" = 'bungkus' WHERE "sku" IN ('MIE-001', 'SMB-002', 'SNK-001', 'SMB-004');
UPDATE "Product" SET "baseUnit" = 'sachet' WHERE "sku" = 'MNM-003';
UPDATE "Product" SET "baseUnit" = 'botol' WHERE "sku" IN ('MNM-001', 'MNM-002', 'SMB-001');
UPDATE "Product" SET "baseUnit" = 'karung' WHERE "sku" = 'SMB-003';
