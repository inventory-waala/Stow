-- Product -> Variant -> Size.
--
-- Until now one `variants` row was a stock unit ("Red / M"). It becomes a
-- named group (Variant) with its own properties and one or more Sizes, each
-- priced and stocked on its own. Variants pick a VariantType independent of
-- the product's ProductType.
--
-- Data: every old variant row becomes one Variant (its name) holding one Size
-- (label from options.size, else "Default"). Ids of the old rows are kept as
-- the Size ids, so barcodes, stock levels and movements only need their FK
-- column renamed.

-- 1. Variant types ----------------------------------------------------------
CREATE TABLE "variant_types" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "attribute_schema" JSONB NOT NULL DEFAULT '{}',
    "axis_label" TEXT,
    "axis_values" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "variant_types_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "variant_types_tenant_id_idx" ON "variant_types"("tenant_id");
CREATE UNIQUE INDEX "variant_types_tenant_id_key_key" ON "variant_types"("tenant_id", "key");

-- 2. Old variants become sizes ---------------------------------------------
ALTER TABLE "variants" RENAME TO "variant_sizes";
ALTER TABLE "variant_sizes" RENAME CONSTRAINT "variants_pkey" TO "variant_sizes_pkey";
ALTER TABLE "variant_sizes" DROP CONSTRAINT "variants_product_id_fkey";
DROP INDEX "variants_tenant_id_idx";
DROP INDEX "variants_product_id_idx";
DROP INDEX "variants_tenant_id_supplier_id_idx";
DROP INDEX "variants_tenant_id_deleted_at_idx";
DROP INDEX "variants_options_idx";
DROP INDEX "variants_attributes_idx";
DROP INDEX "variants_tenant_id_sku_key";

ALTER TABLE "variant_sizes"
    ADD COLUMN "variant_id" TEXT,
    ADD COLUMN "label" TEXT,
    ADD COLUMN "sort" INTEGER NOT NULL DEFAULT 0;

-- 3. New variants table, one group per old row ------------------------------
CREATE TABLE "variants" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_type_id" TEXT,
    "name" TEXT NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "supplier_id" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "src_size_id" TEXT,

    CONSTRAINT "variants_pkey" PRIMARY KEY ("id")
);

INSERT INTO "variants" ("id", "tenant_id", "product_id", "name", "status", "supplier_id", "attributes", "metadata", "created_at", "updated_at", "deleted_at", "src_size_id")
SELECT
    gen_random_uuid()::text,
    s."tenant_id",
    s."product_id",
    -- names are unique per product from now on; suffix any clash
    CASE WHEN rn = 1 THEN s."name" ELSE s."name" || ' (' || rn || ')' END,
    s."status",
    s."supplier_id",
    s."attributes",
    s."metadata",
    s."created_at",
    s."updated_at",
    s."deleted_at",
    s."id"
FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY "tenant_id", "product_id", "name" ORDER BY "created_at", "id") AS rn
    FROM "variant_sizes"
) s;

UPDATE "variant_sizes" s
SET "variant_id" = v."id",
    "label" = COALESCE(NULLIF(s."options"->>'size', ''), 'Default')
FROM "variants" v
WHERE v."src_size_id" = s."id";

ALTER TABLE "variants" DROP COLUMN "src_size_id";
ALTER TABLE "variant_sizes"
    ALTER COLUMN "variant_id" SET NOT NULL,
    ALTER COLUMN "label" SET NOT NULL,
    DROP COLUMN "product_id",
    DROP COLUMN "name",
    DROP COLUMN "status",
    DROP COLUMN "options",
    DROP COLUMN "supplier_id";

CREATE INDEX "variants_tenant_id_idx" ON "variants"("tenant_id");
CREATE INDEX "variants_product_id_idx" ON "variants"("product_id");
CREATE INDEX "variants_tenant_id_variant_type_id_idx" ON "variants"("tenant_id", "variant_type_id");
CREATE INDEX "variants_tenant_id_deleted_at_idx" ON "variants"("tenant_id", "deleted_at");
CREATE INDEX "variants_attributes_idx" ON "variants" USING GIN ("attributes" jsonb_path_ops);
CREATE UNIQUE INDEX "variants_tenant_id_product_id_name_key" ON "variants"("tenant_id", "product_id", "name");
ALTER TABLE "variants" ADD CONSTRAINT "variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "variants" ADD CONSTRAINT "variants_variant_type_id_fkey" FOREIGN KEY ("variant_type_id") REFERENCES "variant_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "variant_sizes_tenant_id_idx" ON "variant_sizes"("tenant_id");
CREATE INDEX "variant_sizes_variant_id_idx" ON "variant_sizes"("variant_id");
CREATE INDEX "variant_sizes_tenant_id_deleted_at_idx" ON "variant_sizes"("tenant_id", "deleted_at");
CREATE UNIQUE INDEX "variant_sizes_tenant_id_sku_key" ON "variant_sizes"("tenant_id", "sku");
CREATE UNIQUE INDEX "variant_sizes_variant_id_label_key" ON "variant_sizes"("variant_id", "label");
ALTER TABLE "variant_sizes" ADD CONSTRAINT "variant_sizes_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Barcodes, stock levels, movements now hang off sizes -------------------
ALTER TABLE "barcodes" DROP CONSTRAINT "barcodes_variant_id_fkey";
DROP INDEX "barcodes_variant_id_idx";
ALTER TABLE "barcodes" RENAME COLUMN "variant_id" TO "size_id";
CREATE INDEX "barcodes_size_id_idx" ON "barcodes"("size_id");
ALTER TABLE "barcodes" ADD CONSTRAINT "barcodes_size_id_fkey" FOREIGN KEY ("size_id") REFERENCES "variant_sizes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_levels" DROP CONSTRAINT "stock_levels_variant_id_fkey";
DROP INDEX "stock_levels_variant_id_location_id_key";
ALTER TABLE "stock_levels" RENAME COLUMN "variant_id" TO "size_id";
CREATE UNIQUE INDEX "stock_levels_size_id_location_id_key" ON "stock_levels"("size_id", "location_id");
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_size_id_fkey" FOREIGN KEY ("size_id") REFERENCES "variant_sizes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_variant_id_fkey";
DROP INDEX "stock_movements_variant_id_occurred_at_idx";
ALTER TABLE "stock_movements" RENAME COLUMN "variant_id" TO "size_id";
CREATE INDEX "stock_movements_size_id_occurred_at_idx" ON "stock_movements"("size_id", "occurred_at");
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_size_id_fkey" FOREIGN KEY ("size_id") REFERENCES "variant_sizes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Product types no longer describe variants ------------------------------
ALTER TABLE "product_types" DROP COLUMN "option_schema", DROP COLUMN "variant_schema";
