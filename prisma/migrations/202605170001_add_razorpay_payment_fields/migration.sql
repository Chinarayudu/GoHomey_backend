ALTER TABLE "Payment"
ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN IF NOT EXISTS "razorpay_order_id" TEXT,
ADD COLUMN IF NOT EXISTS "razorpay_payment_id" TEXT,
ADD COLUMN IF NOT EXISTS "razorpay_signature" TEXT,
ADD COLUMN IF NOT EXISTS "razorpay_receipt" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_razorpay_order_id_key"
ON "Payment"("razorpay_order_id");

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_razorpay_payment_id_key"
ON "Payment"("razorpay_payment_id");
