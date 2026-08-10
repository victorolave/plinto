-- CreateEnum
CREATE TYPE "CreditLineStatus" AS ENUM ('active', 'closed');

-- CreateTable
CREATE TABLE "credit_lines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "limit_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "CreditLineStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credit_lines_tenant_id_idx" ON "credit_lines"("tenant_id");

-- CreateIndex
CREATE INDEX "credit_lines_tenant_id_status_idx" ON "credit_lines"("tenant_id", "status");

-- A ceiling is not a debt. Guarding it here rather than in the service keeps
-- the invariant true for the import path PRD-010 will add, which does not go
-- through the service at all.
ALTER TABLE "credit_lines" ADD CONSTRAINT "credit_lines_limit_not_negative" CHECK ("limit_minor" >= 0);

-- AddForeignKey
ALTER TABLE "credit_lines" ADD CONSTRAINT "credit_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
