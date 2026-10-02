-- CreateEnum
CREATE TYPE "PantryUnitType" AS ENUM ('ITEM', 'CONTAINER');

-- AlterTable: existing pantry items become single items
ALTER TABLE "PantryItem" ADD COLUMN "unit_type" "PantryUnitType" NOT NULL DEFAULT 'ITEM',
ADD COLUMN "pieces_per_unit" INTEGER NOT NULL DEFAULT 1;

-- AlterTable: snapshot of the pantry unit at order time
ALTER TABLE "OrderItem" ADD COLUMN "pantry_unit_type" "PantryUnitType",
ADD COLUMN "pantry_pieces_per_unit" INTEGER;

-- Backfill past pantry order items as single items
UPDATE "OrderItem" SET "pantry_unit_type" = 'ITEM', "pantry_pieces_per_unit" = 1
WHERE "pantry_id" IS NOT NULL;
