-- Replace the `active` boolean on recurring rules with a single lifecycle enum.
--
-- Rationale: `active = false` already meant "paused", so adding an `archived_at`
-- timestamp (the accounts pattern) would have produced two distinct off-states
-- and allowed the contradictory row `active = true AND archived_at IS NOT NULL`.
-- A single enum keeps one lifecycle state per rule and reduces the execution
-- job's guard to one predicate: status = 'active'.
--
-- Data-preserving: every existing rule is mapped onto the new column before the
-- old one is dropped. No rule is archived by this migration.

CREATE TYPE "RecurringRuleStatus" AS ENUM ('active', 'paused', 'archived');

ALTER TABLE "recurring_transaction_rules"
  ADD COLUMN "status" "RecurringRuleStatus" NOT NULL DEFAULT 'active';

-- active = true  -> 'active'  (still evaluated by the execution job)
-- active = false -> 'paused'  (kept and editable, skipped by the job)
UPDATE "recurring_transaction_rules"
  SET "status" = CASE
    WHEN "active" THEN 'active'::"RecurringRuleStatus"
    ELSE 'paused'::"RecurringRuleStatus"
  END;

DROP INDEX "recurring_transaction_rules_tenant_id_active_idx";

ALTER TABLE "recurring_transaction_rules" DROP COLUMN "active";

CREATE INDEX "recurring_transaction_rules_tenant_id_status_idx"
  ON "recurring_transaction_rules"("tenant_id", "status");
