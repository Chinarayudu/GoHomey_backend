ALTER TABLE "OrderItem"
ADD COLUMN IF NOT EXISTS "fuel_subscription_id" TEXT,
ADD COLUMN IF NOT EXISTS "fuel_subscription_start_date" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "fuel_subscription_delivery_time_slot" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "OrderItem_fuel_subscription_id_key"
ON "OrderItem"("fuel_subscription_id");

ALTER TABLE "OrderItem"
ADD CONSTRAINT "OrderItem_fuel_subscription_id_fkey"
FOREIGN KEY ("fuel_subscription_id") REFERENCES "FuelSubscription"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
