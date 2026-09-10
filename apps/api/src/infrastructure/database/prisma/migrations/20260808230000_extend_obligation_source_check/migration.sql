-- Extends the origin CHECK on `obligation_instances` to admit debt schedules.
--
-- WHY THIS IS A SEPARATE MIGRATION
--
-- The previous one adds `debt_schedule` to the `ObligationSourceType` enum.
-- Postgres will not let a value added by `ALTER TYPE ... ADD VALUE` be *used*
-- until the transaction that added it commits, and Prisma runs each migration
-- in a transaction. Comparing `source_type` against the new literal here is
-- exactly that use, so it has to happen after the previous migration committed.
--
-- WHAT IT ENFORCES
--
-- An instance may never claim an origin it does not reference, nor carry a
-- reference its origin does not admit — now across two possible references
-- rather than one. Each branch pins both columns, including the one that must
-- be NULL, so a row cannot point at a rule and a schedule at the same time and
-- leave the reader to guess which produced it.
--
-- PRD-006 wrote this constraint anticipating exactly this change, and PRD-007
-- is where it arrives. Prisma does not model CHECK constraints, so it lives
-- only in the migration history and is invisible to the schema diff.

ALTER TABLE "obligation_instances"
  DROP CONSTRAINT "obligation_instances_source_matches_reference";

ALTER TABLE "obligation_instances"
  ADD CONSTRAINT "obligation_instances_source_matches_reference" CHECK (
    (
      "source_type" = 'recurring_rule'
      AND "recurring_rule_id" IS NOT NULL
      AND "debt_schedule_id" IS NULL
    )
    OR (
      "source_type" = 'manual'
      AND "recurring_rule_id" IS NULL
      AND "debt_schedule_id" IS NULL
    )
    OR (
      "source_type" = 'debt_schedule'
      AND "debt_schedule_id" IS NOT NULL
      AND "recurring_rule_id" IS NULL
    )
  );
