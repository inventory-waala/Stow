-- Per-SKU field definitions (weight, MPN, dimensions...) validated against Variant.attributes
ALTER TABLE "product_types" ADD COLUMN "variant_schema" JSONB NOT NULL DEFAULT '{}';
