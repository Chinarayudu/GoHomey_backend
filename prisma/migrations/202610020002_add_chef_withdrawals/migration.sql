-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'REJECTED');

-- AlterTable
ALTER TABLE "Chef" ADD COLUMN     "bank_holder_name" TEXT;

-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL,
    "chef_id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "account_label" TEXT NOT NULL,
    "bank_holder_name" TEXT NOT NULL,
    "bank_name" TEXT,
    "bank_account_number" TEXT NOT NULL,
    "ifsc_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "paid_at" TIMESTAMP(3),
    "utr" TEXT,
    "rejection_reason" TEXT,
    "rejection_details" TEXT,
    "idempotency_key" TEXT,

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WithdrawalEvent" (
    "id" TEXT NOT NULL,
    "withdrawal_id" TEXT NOT NULL,
    "from_status" "WithdrawalStatus",
    "to_status" "WithdrawalStatus" NOT NULL,
    "actor_role" "Role" NOT NULL,
    "actor_id" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WithdrawalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Withdrawal_reference_key" ON "Withdrawal"("reference");

-- CreateIndex
CREATE INDEX "Withdrawal_chef_id_created_at_idx" ON "Withdrawal"("chef_id", "created_at");

-- CreateIndex
CREATE INDEX "Withdrawal_status_created_at_idx" ON "Withdrawal"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "Withdrawal_chef_id_idempotency_key_key" ON "Withdrawal"("chef_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "WithdrawalEvent_withdrawal_id_created_at_idx" ON "WithdrawalEvent"("withdrawal_id", "created_at");

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_chef_id_fkey" FOREIGN KEY ("chef_id") REFERENCES "Chef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalEvent" ADD CONSTRAINT "WithdrawalEvent_withdrawal_id_fkey" FOREIGN KEY ("withdrawal_id") REFERENCES "Withdrawal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

