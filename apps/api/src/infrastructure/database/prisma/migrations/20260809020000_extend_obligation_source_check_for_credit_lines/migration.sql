-- Extends the origin CHECK on `obligation_instances` to admit credit-line
-- statements.
--
-- WHY THIS IS A SEPARATE MIGRATION
--
-- The previous one adds `credit_line` to the `ObligationSourceType` enum.
-- Postgres will not let a value added by `ALTER TYPE ... ADD VALUE` be *used*
-- until the transaction that added it commits, and Prisma runs each migration
-- in a transaction. Comparing `source_type` against the new literal here is
-- exactly that use, so it has to happen after the previous migration committed.
--
-- This is the second time the constraint has grown for this reason. PRD-006
-- wrote it anticipating the growth; PRD-007 took the first branch, and PRD-011
-- takes this one.
--
-- WHAT IT ENFORCES
--
-- An instance may never claim an origin it does not reference, nor carry a
-- reference its origin does not admit — now across three possible references
-- rather than two. Every branch pins all three columns, including the ones
-- that must be NULL, so a row cannot point at two origins at once and leave
-- the reader to guess which produced it.
--
-- Prisma does not model CHECK constraints, so this lives only in the migration
-- history and is invisible to the schema diff.

ALTER TABLE "obligation_instances"
  DROP CONSTRAINT "obligation_instances_source_matches_reference";

ALTER TABLE "obligation_instances"
  ADD CONSTRAINT "obligation_instances_source_matches_reference" CHECK (
    (
      "source_type" = 'recurring_rule'
      AND "recurring_rule_id" IS NOT NULL
      AND "debt_schedule_id" IS NULL
      AND "credit_line_statement_id" IS NULL
    )
    OR (
      "source_type" = 'manual'
      AND "recurring_rule_id" IS NULL
      AND "debt_schedule_id" IS NULL
      AND "credit_line_statement_id" IS NULL
    )
    OR (
      "source_type" = 'debt_schedule'
      AND "debt_schedule_id" IS NOT NULL
      AND "recurring_rule_id" IS NULL
      AND "credit_line_statement_id" IS NULL
    )
    OR (
      "source_type" = 'credit_line'
      AND "credit_line_statement_id" IS NOT NULL
      AND "recurring_rule_id" IS NULL
      AND "debt_schedule_id" IS NULL
    )
  );
