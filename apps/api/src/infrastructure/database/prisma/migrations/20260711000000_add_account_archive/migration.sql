-- Soft-delete support for accounts.
-- Deleting an account with transactions/transfers/recurring rules would violate
-- required foreign keys, so deletion is modelled as archiving instead: the row is
-- kept (preserving financial history) and hidden from active listings.
-- This migration is additive: existing accounts default to archived_at NULL (active).

ALTER TABLE "accounts"
  ADD COLUMN "archived_at" TIMESTAMP(3);

CREATE INDEX "accounts_tenant_id_archived_at_idx" ON "accounts"("tenant_id", "archived_at");
