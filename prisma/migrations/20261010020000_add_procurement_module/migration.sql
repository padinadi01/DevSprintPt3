-- Migration: add_procurement_module
-- Adds: Supplier, Receiver, PurchaseOrder, PurchaseOrderItem,
--       GoodsReceipt, GoodsReceiptItem, new StockMovementType values,
--       and two new columns on Product.
-- Existing data and constraints are untouched.

-- -------------------------------------------------------------------------
-- 1. Extend existing enum (must happen before tables that reference it)
-- -------------------------------------------------------------------------
-- ALTER TYPE … ADD VALUE cannot run inside a transaction block in PostgreSQL.
-- Prisma's migration runner executes each statement individually, so this is safe.
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'PROCUREMENT_IN';
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'PROCUREMENT_REJECT';

-- -------------------------------------------------------------------------
-- 2. New enum types
-- -------------------------------------------------------------------------
CREATE TYPE "PurchaseOrderStatus" AS ENUM (
  'OPEN',
  'PARTIALLY_RECEIVED',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "GoodsReceiptStatus" AS ENUM (
  'RECEIVED',
  'CANCELLED'
);

-- -------------------------------------------------------------------------
-- 3. Extend Product with purchase-unit columns
--    Default 'pcs' / 1 keeps every existing row valid immediately.
-- -------------------------------------------------------------------------
ALTER TABLE "Product"
  ADD COLUMN "unitOfPurchase"   TEXT    NOT NULL DEFAULT 'pcs',
  ADD COLUMN "unitsPerPurchase" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_unitsPerPurchase_positive"
  CHECK ("unitsPerPurchase" > 0);

-- Add the composite index on StockMovement that the updated schema now declares.
CREATE INDEX IF NOT EXISTS "StockMovement_referenceType_referenceId_idx"
  ON "StockMovement"("referenceType", "referenceId");

-- -------------------------------------------------------------------------
-- 4. Supplier
-- -------------------------------------------------------------------------
CREATE TABLE "Supplier" (
  "id"        UUID         NOT NULL,
  "name"      TEXT         NOT NULL,
  "phone"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- -------------------------------------------------------------------------
-- 5. Receiver  (Udin, Sari, …)
-- -------------------------------------------------------------------------
CREATE TABLE "Receiver" (
  "id"        UUID         NOT NULL,
  "name"      TEXT         NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Receiver_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Receiver_name_key" ON "Receiver"("name");

-- -------------------------------------------------------------------------
-- 6. PurchaseOrder
-- -------------------------------------------------------------------------
CREATE TABLE "PurchaseOrder" (
  "id"         UUID                    NOT NULL,
  "supplierId" UUID                    NOT NULL,
  "status"     "PurchaseOrderStatus"   NOT NULL DEFAULT 'OPEN',
  "orderDate"  TIMESTAMP(3)            NOT NULL,
  "note"       TEXT,
  "createdAt"  TIMESTAMP(3)            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3)            NOT NULL,
  CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");
CREATE INDEX "PurchaseOrder_status_idx"     ON "PurchaseOrder"("status");
CREATE INDEX "PurchaseOrder_orderDate_idx"  ON "PurchaseOrder"("orderDate");

ALTER TABLE "PurchaseOrder"
  ADD CONSTRAINT "PurchaseOrder_supplierId_fkey"
  FOREIGN KEY ("supplierId")
  REFERENCES "Supplier"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- -------------------------------------------------------------------------
-- 7. PurchaseOrderItem
-- -------------------------------------------------------------------------
CREATE TABLE "PurchaseOrderItem" (
  "id"              UUID    NOT NULL,
  "purchaseOrderId" UUID    NOT NULL,
  "productId"       UUID    NOT NULL,
  "orderedQty"      INTEGER NOT NULL,
  CONSTRAINT "PurchaseOrderItem_pkey"              PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseOrderItem_orderedQty_positive" CHECK ("orderedQty" > 0)
);

CREATE INDEX "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId");
CREATE INDEX "PurchaseOrderItem_productId_idx"       ON "PurchaseOrderItem"("productId");

ALTER TABLE "PurchaseOrderItem"
  ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey"
  FOREIGN KEY ("purchaseOrderId")
  REFERENCES "PurchaseOrder"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderItem"
  ADD CONSTRAINT "PurchaseOrderItem_productId_fkey"
  FOREIGN KEY ("productId")
  REFERENCES "Product"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- -------------------------------------------------------------------------
-- 8. GoodsReceipt  (append-only header)
-- -------------------------------------------------------------------------
CREATE TABLE "GoodsReceipt" (
  "id"              UUID                  NOT NULL,
  "purchaseOrderId" UUID,
  "supplierId"      UUID                  NOT NULL,
  "receiverId"      UUID                  NOT NULL,
  "status"          "GoodsReceiptStatus"  NOT NULL DEFAULT 'RECEIVED',
  "receivedAt"      TIMESTAMP(3)          NOT NULL,
  "idempotencyKey"  TEXT                  NOT NULL,
  "note"            TEXT,
  "createdAt"       TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GoodsReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoodsReceipt_idempotencyKey_key" ON "GoodsReceipt"("idempotencyKey");
CREATE INDEX "GoodsReceipt_supplierId_idx"      ON "GoodsReceipt"("supplierId");
CREATE INDEX "GoodsReceipt_receiverId_idx"      ON "GoodsReceipt"("receiverId");
CREATE INDEX "GoodsReceipt_purchaseOrderId_idx" ON "GoodsReceipt"("purchaseOrderId");
CREATE INDEX "GoodsReceipt_receivedAt_idx"      ON "GoodsReceipt"("receivedAt");

ALTER TABLE "GoodsReceipt"
  ADD CONSTRAINT "GoodsReceipt_supplierId_fkey"
  FOREIGN KEY ("supplierId")
  REFERENCES "Supplier"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GoodsReceipt"
  ADD CONSTRAINT "GoodsReceipt_receiverId_fkey"
  FOREIGN KEY ("receiverId")
  REFERENCES "Receiver"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GoodsReceipt"
  ADD CONSTRAINT "GoodsReceipt_purchaseOrderId_fkey"
  FOREIGN KEY ("purchaseOrderId")
  REFERENCES "PurchaseOrder"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- -------------------------------------------------------------------------
-- 9. GoodsReceiptItem  (append-only detail; cost columns are frozen snapshots)
-- -------------------------------------------------------------------------
CREATE TABLE "GoodsReceiptItem" (
  "id"                      UUID          NOT NULL,
  "receiptId"               UUID          NOT NULL,
  "productId"               UUID          NOT NULL,
  "receivedQty"             INTEGER       NOT NULL,
  "rejectedQty"             INTEGER       NOT NULL DEFAULT 0,
  "rejectedReason"          TEXT,
  "isBonus"                 BOOLEAN       NOT NULL DEFAULT false,
  "unitCostPerPurchaseUnit" DECIMAL(12,2) NOT NULL,
  "unitCostPerBaseUnit"     DECIMAL(12,2) NOT NULL,
  "createdAt"               TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GoodsReceiptItem_pkey"                             PRIMARY KEY ("id"),
  -- Quantities
  CONSTRAINT "GoodsReceiptItem_receivedQty_non_negative"         CHECK ("receivedQty" >= 0),
  CONSTRAINT "GoodsReceiptItem_rejectedQty_non_negative"         CHECK ("rejectedQty" >= 0),
  CONSTRAINT "GoodsReceiptItem_rejectedQty_le_receivedQty"       CHECK ("rejectedQty" <= "receivedQty"),
  -- A rejection must have a documented reason
  CONSTRAINT "GoodsReceiptItem_rejectedReason_required"
    CHECK ("rejectedQty" = 0 OR "rejectedReason" IS NOT NULL),
  -- Bonus items have zero cost; non-bonus items must have a positive cost
  CONSTRAINT "GoodsReceiptItem_unitCostPerPurchaseUnit_non_negative"
    CHECK ("unitCostPerPurchaseUnit" >= 0),
  CONSTRAINT "GoodsReceiptItem_unitCostPerBaseUnit_non_negative"
    CHECK ("unitCostPerBaseUnit" >= 0),
  CONSTRAINT "GoodsReceiptItem_bonus_cost_rule"
    CHECK ("isBonus" = false OR "unitCostPerPurchaseUnit" = 0)
);

CREATE INDEX "GoodsReceiptItem_receiptId_idx"  ON "GoodsReceiptItem"("receiptId");
CREATE INDEX "GoodsReceiptItem_productId_idx"  ON "GoodsReceiptItem"("productId");

ALTER TABLE "GoodsReceiptItem"
  ADD CONSTRAINT "GoodsReceiptItem_receiptId_fkey"
  FOREIGN KEY ("receiptId")
  REFERENCES "GoodsReceipt"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GoodsReceiptItem"
  ADD CONSTRAINT "GoodsReceiptItem_productId_fkey"
  FOREIGN KEY ("productId")
  REFERENCES "Product"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
