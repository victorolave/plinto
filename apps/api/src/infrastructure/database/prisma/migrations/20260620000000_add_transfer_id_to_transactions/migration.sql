-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "transfer_id" TEXT;

-- CreateIndex
CREATE INDEX "transactions_transfer_id_idx" ON "transactions"("transfer_id");
