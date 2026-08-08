-- CreateEnum
CREATE TYPE "DebtScheduleStatus" AS ENUM ('active', 'cancelled');

-- AlterEnum
ALTER TYPE "ObligationSourceType" ADD VALUE 'debt_schedule';

-- AlterTable
ALTER TABLE "obligation_instances" ADD COLUMN     "debt_schedule_id" TEXT;

-- CreateTable
CREATE TABLE "debt_schedules" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "principal_minor" INTEGER NOT NULL,
    "installment_minor" INTEGER NOT NULL,
    "installment_count" INTEGER NOT NULL,
    "first_due_date" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "DebtScheduleStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debt_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "debt_schedules_tenant_id_idx" ON "debt_schedules"("tenant_id");

-- CreateIndex
CREATE INDEX "debt_schedules_tenant_id_status_idx" ON "debt_schedules"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "obligation_instances_debt_schedule_id_period_key" ON "obligation_instances"("debt_schedule_id", "period");

-- AddForeignKey
ALTER TABLE "obligation_instances" ADD CONSTRAINT "obligation_instances_debt_schedule_id_fkey" FOREIGN KEY ("debt_schedule_id") REFERENCES "debt_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_schedules" ADD CONSTRAINT "debt_schedules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_schedules" ADD CONSTRAINT "debt_schedules_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

