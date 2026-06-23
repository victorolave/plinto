-- Add categories table and link transactions to categories.
-- Category deletion sets transactions.category_id to NULL (ON DELETE SET NULL).
-- This migration is additive: existing transactions default to category_id NULL.

CREATE TABLE "categories" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "TransactionType" NOT NULL,
  "color" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "transactions"
  ADD COLUMN "category_id" TEXT;

CREATE INDEX "categories_tenant_id_idx" ON "categories"("tenant_id");
CREATE INDEX "transactions_tenant_id_category_id_idx" ON "transactions"("tenant_id", "category_id");

ALTER TABLE "categories"
  ADD CONSTRAINT "categories_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
