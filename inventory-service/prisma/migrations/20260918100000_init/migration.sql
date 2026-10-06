-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "inventory";

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('IN', 'OUT', 'ADJUST', 'TRANSFER');

-- CreateEnum
CREATE TYPE "BarcodeType" AS ENUM ('CODE128', 'CODE39', 'CODE93', 'EAN13', 'EAN8', 'UPC_A', 'UPC_E', 'QR_CODE', 'DATA_MATRIX', 'PDF417', 'AZTEC', 'CODABAR', 'ITF', 'CUSTOM');

-- CreateTable
CREATE TABLE "product_types" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "attribute_schema" JSONB NOT NULL DEFAULT '{}',
    "option_schema" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_type_id" TEXT,
    "category_id" TEXT,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variants" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "options" JSONB NOT NULL DEFAULT '{}',
    "cost_price" DECIMAL(18,4),
    "sell_price" DECIMAL(18,4),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "supplier_id" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "barcodes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" "BarcodeType" NOT NULL DEFAULT 'CODE128',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "barcodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_levels" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "reorder_at" DECIMAL(18,4),
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "from_location_id" TEXT,
    "to_location_id" TEXT,
    "actor_id" TEXT,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "reason" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_types_tenant_id_idx" ON "product_types"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_types_tenant_id_key_key" ON "product_types"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "categories_tenant_id_idx" ON "categories"("tenant_id");

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_tenant_id_slug_key" ON "categories"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "products_tenant_id_idx" ON "products"("tenant_id");

-- CreateIndex
CREATE INDEX "products_tenant_id_status_idx" ON "products"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "products_tenant_id_product_type_id_idx" ON "products"("tenant_id", "product_type_id");

-- CreateIndex
CREATE INDEX "products_tenant_id_category_id_idx" ON "products"("tenant_id", "category_id");

-- CreateIndex
CREATE INDEX "products_tenant_id_deleted_at_idx" ON "products"("tenant_id", "deleted_at");

-- CreateIndex
CREATE INDEX "products_attributes_idx" ON "products" USING GIN ("attributes" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "products_tags_idx" ON "products" USING GIN ("tags");

-- CreateIndex
CREATE UNIQUE INDEX "products_tenant_id_code_key" ON "products"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "variants_tenant_id_idx" ON "variants"("tenant_id");

-- CreateIndex
CREATE INDEX "variants_product_id_idx" ON "variants"("product_id");

-- CreateIndex
CREATE INDEX "variants_tenant_id_supplier_id_idx" ON "variants"("tenant_id", "supplier_id");

-- CreateIndex
CREATE INDEX "variants_tenant_id_deleted_at_idx" ON "variants"("tenant_id", "deleted_at");

-- CreateIndex
CREATE INDEX "variants_options_idx" ON "variants" USING GIN ("options" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "variants_attributes_idx" ON "variants" USING GIN ("attributes" jsonb_path_ops);

-- CreateIndex
CREATE UNIQUE INDEX "variants_tenant_id_sku_key" ON "variants"("tenant_id", "sku");

-- CreateIndex
CREATE INDEX "barcodes_variant_id_idx" ON "barcodes"("variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "barcodes_tenant_id_value_key" ON "barcodes"("tenant_id", "value");

-- CreateIndex
CREATE INDEX "locations_tenant_id_idx" ON "locations"("tenant_id");

-- CreateIndex
CREATE INDEX "locations_parent_id_idx" ON "locations"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "locations_tenant_id_code_key" ON "locations"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "stock_levels_tenant_id_idx" ON "stock_levels"("tenant_id");

-- CreateIndex
CREATE INDEX "stock_levels_location_id_idx" ON "stock_levels"("location_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_levels_variant_id_location_id_key" ON "stock_levels"("variant_id", "location_id");

-- CreateIndex
CREATE INDEX "stock_movements_tenant_id_occurred_at_idx" ON "stock_movements"("tenant_id", "occurred_at");

-- CreateIndex
CREATE INDEX "stock_movements_variant_id_occurred_at_idx" ON "stock_movements"("variant_id", "occurred_at");

-- CreateIndex
CREATE INDEX "stock_movements_tenant_id_reference_type_reference_id_idx" ON "stock_movements"("tenant_id", "reference_type", "reference_id");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_product_type_id_fkey" FOREIGN KEY ("product_type_id") REFERENCES "product_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variants" ADD CONSTRAINT "variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barcodes" ADD CONSTRAINT "barcodes_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

