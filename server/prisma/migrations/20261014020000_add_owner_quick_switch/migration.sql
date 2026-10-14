ALTER TABLE "AuthSession"
    ADD COLUMN "actingAsUserId" UUID;

CREATE INDEX "AuthSession_actingAsUserId_idx" ON "AuthSession"("actingAsUserId");

ALTER TABLE "AuthSession"
    ADD CONSTRAINT "AuthSession_actingAsUserId_fkey"
    FOREIGN KEY ("actingAsUserId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AuthSwitchAudit" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "targetUserId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSwitchAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuthSwitchAudit_ownerUserId_createdAt_idx"
    ON "AuthSwitchAudit"("ownerUserId", "createdAt");
CREATE INDEX "AuthSwitchAudit_targetUserId_createdAt_idx"
    ON "AuthSwitchAudit"("targetUserId", "createdAt");

ALTER TABLE "AuthSwitchAudit"
    ADD CONSTRAINT "AuthSwitchAudit_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuthSwitchAudit"
    ADD CONSTRAINT "AuthSwitchAudit_targetUserId_fkey"
    FOREIGN KEY ("targetUserId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
