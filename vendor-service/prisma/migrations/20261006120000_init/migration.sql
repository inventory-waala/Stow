-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "vendor";

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('DRAFT', 'PENDING', 'ORDERED', 'APPROVED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('NONE', 'PERCENT', 'AMOUNT');

-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "state" TEXT,
    "division" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "cin" TEXT,
    "status" "SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "invoice_no" TEXT NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'DRAFT',
    "order_date" TIMESTAMP(3) NOT NULL,
    "subtotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "discount_type" "DiscountType" NOT NULL DEFAULT 'NONE',
    "discount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "taxable_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "cgst" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "sgst" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "igst" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "notes" TEXT,
    "remarks" TEXT,
    "location_id" TEXT,
    "received_at" TIMESTAMP(3),
    "stock_posted_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "purchase_id" TEXT NOT NULL,
    "size_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "variant_name" TEXT NOT NULL,
    "size_label" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit_price" DECIMAL(18,4) NOT NULL,
    "discount_type" "DiscountType" NOT NULL DEFAULT 'NONE',
    "discount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total_price" DECIMAL(18,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_tenant_id_code_key" ON "suppliers"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_tenant_id_gstin_key" ON "suppliers"("tenant_id", "gstin");

-- CreateIndex
CREATE INDEX "suppliers_tenant_id_status_idx" ON "suppliers"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "suppliers_tenant_id_name_idx" ON "suppliers"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_tenant_id_invoice_no_key" ON "purchase_orders"("tenant_id", "invoice_no");

-- CreateIndex
CREATE INDEX "purchase_orders_tenant_id_status_idx" ON "purchase_orders"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "purchase_orders_tenant_id_order_date_idx" ON "purchase_orders"("tenant_id", "order_date");

-- CreateIndex
CREATE INDEX "purchase_orders_supplier_id_idx" ON "purchase_orders"("supplier_id");

-- CreateIndex
CREATE INDEX "purchase_items_purchase_id_idx" ON "purchase_items"("purchase_id");

-- CreateIndex
CREATE INDEX "purchase_items_tenant_id_size_id_idx" ON "purchase_items"("tenant_id", "size_id");

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
