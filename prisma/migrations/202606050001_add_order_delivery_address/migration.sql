ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "delivery_address_id" TEXT;

ALTER TABLE "Order"
ADD CONSTRAINT "Order_delivery_address_id_fkey"
FOREIGN KEY ("delivery_address_id") REFERENCES "Address"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Order_delivery_address_id_idx"
ON "Order"("delivery_address_id");
