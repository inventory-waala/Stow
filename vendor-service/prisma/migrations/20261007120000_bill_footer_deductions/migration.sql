-- The bill footer becomes a ladder of named rungs instead of one discount
-- slot. Safe to drop discount_type outright: no purchase order has been
-- written yet.

-- CreateEnum
CREATE TYPE "vendor"."DeductionBasis" AS ENUM ('PERCENT', 'AMOUNT');

-- CreateEnum
CREATE TYPE "vendor"."DeductionBase" AS ENUM ('RUNNING', 'GROSS');

-- CreateEnum
CREATE TYPE "vendor"."RoundingMode" AS ENUM ('NONE', 'NORMAL', 'UP', 'DOWN');

-- AlterTable
ALTER TABLE "vendor"."purchase_orders"
  DROP COLUMN "discount_type",
  ADD COLUMN "round_off" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "rounding" "vendor"."RoundingMode" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "rounding_precision" DECIMAL(18,4) NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "vendor"."purchase_deductions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "purchase_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "basis" "vendor"."DeductionBasis" NOT NULL,
    "applies_to" "vendor"."DeductionBase" NOT NULL DEFAULT 'RUNNING',
    "value" DECIMAL(18,4) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_deductions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_deductions_purchase_id_sequence_key" ON "vendor"."purchase_deductions"("purchase_id", "sequence");

-- CreateIndex
CREATE INDEX "purchase_deductions_purchase_id_idx" ON "vendor"."purchase_deductions"("purchase_id");

-- CreateIndex
CREATE INDEX "purchase_deductions_tenant_id_code_idx" ON "vendor"."purchase_deductions"("tenant_id", "code");

-- AddForeignKey
ALTER TABLE "vendor"."purchase_deductions"
  ADD CONSTRAINT "purchase_deductions_purchase_id_fkey"
  FOREIGN KEY ("purchase_id") REFERENCES "vendor"."purchase_orders"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
