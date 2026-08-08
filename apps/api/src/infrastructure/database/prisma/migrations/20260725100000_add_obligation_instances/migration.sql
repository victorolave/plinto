-- Obligation instances: what the household is expected to pay in a given
-- period, and the transactions that settle it.
--
-- The instance table stores only facts (expected amount, due date, origin).
-- The lifecycle state (pending / partial / paid / overdue) is derived at read
-- time from the linked payments and the due date, so there is deliberately no
-- status column: a stored state could contradict the payments backing it, and
-- would need a job to age instances into "overdue".

CREATE TYPE "ObligationSourceType" AS ENUM ('recurring_rule', 'manual');

CREATE TABLE "obligation_instances" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "source_type" "ObligationSourceType" NOT NULL,
  "recurring_rule_id" TEXT,
  "period" TEXT NOT NULL,
  "due_date" TIMESTAMP(3) NOT NULL,
  "name" TEXT NOT NULL,
  "expected_amount_minor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "obligation_instances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "obligation_payments" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "obligation_instance_id" TEXT NOT NULL,
  "transaction_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "obligation_payments_pkey" PRIMARY KEY ("id")
);

-- Idempotency of generation. Postgres treats NULLs as distinct, so this blocks
-- a second instance for the same (rule, period) while still allowing any number
-- of one-off obligations inside the same period.
CREATE UNIQUE INDEX "obligation_instances_recurring_rule_id_period_key"
  ON "obligation_instances"("recurring_rule_id", "period");

CREATE INDEX "obligation_instances_tenant_id_period_idx"
  ON "obligation_instances"("tenant_id", "period");

-- Global uniqueness, not per-instance: this is what makes "a transaction
-- cannot reconcile two obligations" a guarantee of the engine.
CREATE UNIQUE INDEX "obligation_payments_transaction_id_key"
  ON "obligation_payments"("transaction_id");

CREATE UNIQUE INDEX "obligation_payments_obligation_instance_id_transaction_id_key"
  ON "obligation_payments"("obligation_instance_id", "transaction_id");

CREATE INDEX "obligation_payments_tenant_id_idx" ON "obligation_payments"("tenant_id");
CREATE INDEX "obligation_payments_obligation_instance_id_idx"
  ON "obligation_payments"("obligation_instance_id");

ALTER TABLE "obligation_instances"
  ADD CONSTRAINT "obligation_instances_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "obligation_instances"
  ADD CONSTRAINT "obligation_instances_recurring_rule_id_fkey"
  FOREIGN KEY ("recurring_rule_id") REFERENCES "recurring_transaction_rules"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "obligation_payments"
  ADD CONSTRAINT "obligation_payments_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "obligation_payments"
  ADD CONSTRAINT "obligation_payments_obligation_instance_id_fkey"
  FOREIGN KEY ("obligation_instance_id") REFERENCES "obligation_instances"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "obligation_payments"
  ADD CONSTRAINT "obligation_payments_transaction_id_fkey"
  FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keeps the declared origin and the populated reference in agreement, so an
-- instance can never claim an origin it does not actually reference, nor carry
-- a reference its origin does not admit. PRD-007 extends this constraint when
-- it adds `debt_schedule` and its own foreign key.
--
-- Prisma does not model CHECK constraints, so this lives only in the migration
-- history. `prisma migrate dev` preserves it (it is invisible to the schema
-- diff) but will not recreate it if the table is ever rebuilt from
-- schema.prisma alone.
ALTER TABLE "obligation_instances"
  ADD CONSTRAINT "obligation_instances_source_matches_reference" CHECK (
    ("source_type" = 'recurring_rule' AND "recurring_rule_id" IS NOT NULL)
    OR ("source_type" = 'manual' AND "recurring_rule_id" IS NULL)
  );
