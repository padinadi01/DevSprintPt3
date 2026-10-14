-- Add rejectedBaseQty to GoodsReceiptItem to allow rejecting damaged items at base unit level (e.g. 1 bungkus out of 3 dus)
ALTER TABLE "GoodsReceiptItem" ADD COLUMN IF NOT EXISTS "rejectedBaseQty" INTEGER NOT NULL DEFAULT 0;
