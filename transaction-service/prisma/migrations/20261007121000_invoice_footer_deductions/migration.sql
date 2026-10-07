-- The invoice footer becomes a ladder of named rungs. discount +
-- special_discount were already two rungs of the same idea running out of
-- columns, so both pairs go. Safe to drop outright: no order has been written
-- yet.

-- CreateEnum
CREATE TYPE "transaction"."DeductionBasis" AS ENUM ('PERCENT', 'AMOUNT');

-- CreateEnum
CREATE TYPE "transaction"."DeductionBase" AS ENUM ('RUNNING', 'GROSS');

-- CreateEnum
CREATE TYPE "transaction"."RoundingMode" AS ENUM ('NONE', 'NORMAL', 'UP', 'DOWN');

-- AlterTable
ALTER TABLE "transaction"."orders"
  DROP COLUMN "discount_type",
  DROP COLUMN "special_discount_type",
  DROP COLUMN "special_discount",
  ADD COLUMN "round_off" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "rounding" "transaction"."RoundingMode" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "rounding_precision" DECIMAL(18,4) NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "transaction"."order_deductions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "basis" "transaction"."DeductionBasis" NOT NULL,
    "applies_to" "transaction"."DeductionBase" NOT NULL DEFAULT 'RUNNING',
    "value" DECIMAL(18,4) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_deductions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_deductions_order_id_sequence_key" ON "transaction"."order_deductions"("order_id", "sequence");

-- CreateIndex
CREATE INDEX "order_deductions_order_id_idx" ON "transaction"."order_deductions"("order_id");

-- CreateIndex
CREATE INDEX "order_deductions_tenant_id_code_idx" ON "transaction"."order_deductions"("tenant_id", "code");

-- AddForeignKey
ALTER TABLE "transaction"."order_deductions"
  ADD CONSTRAINT "order_deductions_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "transaction"."orders"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
