-- CreateTable
CREATE TABLE "ChefPayout" (
    "id" TEXT NOT NULL,
    "chef_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "platform_fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commission" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'RELEASED',
    "release_reason" TEXT,
    "released_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChefPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChefPayout_order_id_key" ON "ChefPayout"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "ChefPayout_payment_id_key" ON "ChefPayout"("payment_id");

-- CreateIndex
CREATE INDEX "ChefPayout_chef_id_status_idx" ON "ChefPayout"("chef_id", "status");

-- CreateIndex
CREATE INDEX "ChefPayout_released_at_idx" ON "ChefPayout"("released_at");

-- AddForeignKey
ALTER TABLE "ChefPayout" ADD CONSTRAINT "ChefPayout_chef_id_fkey" FOREIGN KEY ("chef_id") REFERENCES "Chef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChefPayout" ADD CONSTRAINT "ChefPayout_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChefPayout" ADD CONSTRAINT "ChefPayout_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
