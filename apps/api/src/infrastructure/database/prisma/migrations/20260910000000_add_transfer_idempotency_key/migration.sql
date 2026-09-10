-- AlterTable
ALTER TABLE "transfers" ADD COLUMN "idempotency_key" TEXT;

-- CreateIndex
-- Postgres treats NULLs as distinct, so this only constrains transfers that
-- actually carry a client-supplied Idempotency-Key: existing rows (all NULL)
-- need no backfill, and a caller that never sends the header keeps today's
-- behavior. A caller that does send one gets a repeat rejected by this index
-- rather than by a read-then-write check.
CREATE UNIQUE INDEX "transfers_tenant_id_idempotency_key_key" ON "transfers"("tenant_id", "idempotency_key");
