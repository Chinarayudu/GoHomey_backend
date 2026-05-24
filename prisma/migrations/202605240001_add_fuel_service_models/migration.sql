CREATE TYPE "FuelSubscriptionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "FuelFulfillmentStatus" AS ENUM ('SCHEDULED', 'COOKING', 'READY_FOR_PICKUP', 'PICKED_UP', 'DELIVERED', 'PAUSED', 'MISSED', 'CANCELLED');

ALTER TABLE "Chef"
ADD COLUMN IF NOT EXISTS "max_concurrent_slots_per_hour" INTEGER NOT NULL DEFAULT 15;

ALTER TABLE "FuelPlan"
ADD COLUMN IF NOT EXISTS "duration_days" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS "price_to_customer" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "fixed_chef_payout" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "sop_document_url" TEXT;

CREATE TABLE "FuelSubscription" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "assigned_chef_id" TEXT NOT NULL,
    "status" "FuelSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "delivery_time_slot" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FuelSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FuelDailyFulfillment" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "chef_id" TEXT NOT NULL,
    "fulfillment_date" TIMESTAMP(3) NOT NULL,
    "delivery_time_slot" TEXT NOT NULL,
    "delivery_status" "FuelFulfillmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "chef_batch_photo_url" TEXT,
    "weight_verification_grams" INTEGER,
    "chef_reminder_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FuelDailyFulfillment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FuelSubscription_user_id_idx" ON "FuelSubscription"("user_id");
CREATE INDEX "FuelSubscription_assigned_chef_id_delivery_time_slot_status_idx" ON "FuelSubscription"("assigned_chef_id", "delivery_time_slot", "status");
CREATE UNIQUE INDEX "FuelDailyFulfillment_subscription_id_fulfillment_date_key" ON "FuelDailyFulfillment"("subscription_id", "fulfillment_date");
CREATE INDEX "FuelDailyFulfillment_chef_id_fulfillment_date_delivery_time_slot_idx" ON "FuelDailyFulfillment"("chef_id", "fulfillment_date", "delivery_time_slot");

ALTER TABLE "FuelSubscription" ADD CONSTRAINT "FuelSubscription_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FuelSubscription" ADD CONSTRAINT "FuelSubscription_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "FuelPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FuelSubscription" ADD CONSTRAINT "FuelSubscription_assigned_chef_id_fkey" FOREIGN KEY ("assigned_chef_id") REFERENCES "Chef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FuelDailyFulfillment" ADD CONSTRAINT "FuelDailyFulfillment_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "FuelSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FuelDailyFulfillment" ADD CONSTRAINT "FuelDailyFulfillment_chef_id_fkey" FOREIGN KEY ("chef_id") REFERENCES "Chef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "DevicePushToken" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevicePushToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DevicePushToken_token_key" ON "DevicePushToken"("token");
CREATE INDEX "DevicePushToken_user_id_is_active_idx" ON "DevicePushToken"("user_id", "is_active");
ALTER TABLE "DevicePushToken" ADD CONSTRAINT "DevicePushToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
