-- CreateTable
CREATE TABLE "WalletAdjustment" (
    "id" TEXT NOT NULL,
    "chef_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WalletAdjustment_chef_id_created_at_idx" ON "WalletAdjustment"("chef_id", "created_at");

-- AddForeignKey
ALTER TABLE "WalletAdjustment" ADD CONSTRAINT "WalletAdjustment_chef_id_fkey" FOREIGN KEY ("chef_id") REFERENCES "Chef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

