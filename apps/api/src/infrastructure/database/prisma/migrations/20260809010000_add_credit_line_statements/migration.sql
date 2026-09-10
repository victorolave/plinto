-- AlterEnum
ALTER TYPE "ObligationSourceType" ADD VALUE 'credit_line';

-- AlterTable
ALTER TABLE "obligation_instances" ADD COLUMN     "credit_line_statement_id" TEXT;

-- CreateTable
CREATE TABLE "credit_line_statements" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "credit_line_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "cutoff_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "closing_balance_minor" INTEGER NOT NULL,
    "amount_due_minor" INTEGER NOT NULL,
    "limit_minor_snapshot" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_line_statements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credit_line_statements_tenant_id_idx" ON "credit_line_statements"("tenant_id");

-- CreateIndex
CREATE INDEX "credit_line_statements_tenant_id_period_idx" ON "credit_line_statements"("tenant_id", "period");

-- CreateIndex
CREATE INDEX "credit_line_statements_credit_line_id_cutoff_date_idx" ON "credit_line_statements"("credit_line_id", "cutoff_date");

-- A lender does not issue two statements closing on the same day for the same
-- line. Keyed on the cutoff rather than the period, so biweekly billing fits
-- while a double submission of the same statement still cannot.
CREATE UNIQUE INDEX "credit_line_statements_credit_line_id_cutoff_date_key" ON "credit_line_statements"("credit_line_id", "cutoff_date");

-- One obligation per statement, NOT one per period. This is what lets a line
-- bill twice inside one calendar month. Postgres treats NULLs as distinct, so
-- it constrains only the rows that carry a statement.
CREATE UNIQUE INDEX "obligation_instances_credit_line_statement_id_key" ON "obligation_instances"("credit_line_statement_id");

-- Neither figure can be negative: a statement declares what is owed, and a
-- lender owing the household is not a statement. Guarded here rather than in
-- the service so the invariant survives the import path PRD-010 will add.
ALTER TABLE "credit_line_statements" ADD CONSTRAINT "credit_line_statements_amounts_not_negative" CHECK ("closing_balance_minor" >= 0 AND "amount_due_minor" >= 0);

-- What must be paid cannot exceed what is owed in total.
ALTER TABLE "credit_line_statements" ADD CONSTRAINT "credit_line_statements_due_within_balance" CHECK ("amount_due_minor" <= "closing_balance_minor");

-- AddForeignKey
ALTER TABLE "credit_line_statements" ADD CONSTRAINT "credit_line_statements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_line_statements" ADD CONSTRAINT "credit_line_statements_credit_line_id_fkey" FOREIGN KEY ("credit_line_id") REFERENCES "credit_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligation_instances" ADD CONSTRAINT "obligation_instances_credit_line_statement_id_fkey" FOREIGN KEY ("credit_line_statement_id") REFERENCES "credit_line_statements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
