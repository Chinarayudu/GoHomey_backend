-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "rider_name" TEXT,
ADD COLUMN     "rider_phone" TEXT,
ADD COLUMN     "rider_latitude" DOUBLE PRECISION,
ADD COLUMN     "rider_longitude" DOUBLE PRECISION,
ADD COLUMN     "provider_status" TEXT,
ADD COLUMN     "pickup_eta_at" TIMESTAMP(3),
ADD COLUMN     "drop_eta_at" TIMESTAMP(3),
ADD COLUMN     "provider_updated_at" TIMESTAMP(3);
