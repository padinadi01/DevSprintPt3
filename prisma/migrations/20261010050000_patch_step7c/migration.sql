-- AlterTable GoodsReceipt
ALTER TABLE "GoodsReceipt" ADD COLUMN IF NOT EXISTS "reversalReason" TEXT;
ALTER TABLE "GoodsReceipt" ADD COLUMN IF NOT EXISTS "reversedBy" TEXT;
ALTER TABLE "GoodsReceipt" ADD COLUMN IF NOT EXISTS "reversedAt" TIMESTAMP(3);

-- AlterTable GoodsReceiptItem
ALTER TABLE "GoodsReceiptItem" ADD COLUMN IF NOT EXISTS "receivedBaseQty" INTEGER NOT NULL DEFAULT 0;

-- Update Gula 1 kg (SMB-002) baseUnit to 'kg'
UPDATE "Product" SET "baseUnit" = 'kg' WHERE "sku" = 'SMB-002';
