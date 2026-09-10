-- Add monthly recurring transaction rules and worker-ready execution records.
-- This migration is additive: existing manual transactions are preserved and default to source='manual'.

CREATE TYPE "TransactionSource" AS ENUM ('manual', 'job');
CREATE TYPE "RecurringTransactionFrequency" AS ENUM ('monthly');
CREATE TYPE "RecurringExecutionStatus" AS ENUM ('success');

ALTER TABLE "transactions"
  ADD COLUMN "source" "TransactionSource" NOT NULL DEFAULT 'manual',
  ADD COLUMN "recurring_rule_id" TEXT,
  ADD COLUMN "recurring_period" TEXT,
  ADD COLUMN "idempotency_key" TEXT;

CREATE TABLE "recurring_transaction_rules" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "TransactionType" NOT NULL,
  "amount_minor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "frequency" "RecurringTransactionFrequency" NOT NULL DEFAULT 'monthly',
  "day_of_month" INTEGER NOT NULL,
  "start_date" TIMESTAMP(3) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "recurring_transaction_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recurring_transaction_executions" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "rule_id" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "transaction_id" TEXT NOT NULL,
  "status" "RecurringExecutionStatus" NOT NULL DEFAULT 'success',
  "job_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "recurring_transaction_executions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "transactions_recurring_rule_id_idx" ON "transactions"("recurring_rule_id");
CREATE INDEX "transactions_tenant_id_source_idx" ON "transactions"("tenant_id", "source");
CREATE INDEX "recurring_transaction_rules_tenant_id_idx" ON "recurring_transaction_rules"("tenant_id");
CREATE INDEX "recurring_transaction_rules_tenant_id_active_idx" ON "recurring_transaction_rules"("tenant_id", "active");
CREATE INDEX "recurring_transaction_executions_tenant_id_idx" ON "recurring_transaction_executions"("tenant_id");

CREATE UNIQUE INDEX "recurring_transaction_executions_tenant_id_idempotency_key_key"
  ON "recurring_transaction_executions"("tenant_id", "idempotency_key");
CREATE UNIQUE INDEX "recurring_transaction_executions_rule_id_period_key"
  ON "recurring_transaction_executions"("rule_id", "period");
CREATE UNIQUE INDEX "recurring_transaction_executions_transaction_id_key"
  ON "recurring_transaction_executions"("transaction_id");

ALTER TABLE "recurring_transaction_rules"
  ADD CONSTRAINT "recurring_transaction_rules_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recurring_transaction_rules"
  ADD CONSTRAINT "recurring_transaction_rules_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_recurring_rule_id_fkey"
  FOREIGN KEY ("recurring_rule_id") REFERENCES "recurring_transaction_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recurring_transaction_executions"
  ADD CONSTRAINT "recurring_transaction_executions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recurring_transaction_executions"
  ADD CONSTRAINT "recurring_transaction_executions_rule_id_fkey"
  FOREIGN KEY ("rule_id") REFERENCES "recurring_transaction_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recurring_transaction_executions"
  ADD CONSTRAINT "recurring_transaction_executions_transaction_id_fkey"
  FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
