-- Product types are gone: a product is name / code / tags / free attributes.
-- A variant type no longer carries a hardcoded "Size" axis; instead one of
-- its own fields (any key) is marked as the axis with `axis_key`. Existing
-- axes are folded into the schema as a choice field of the same name.

UPDATE "variant_types"
SET "attribute_schema" = jsonb_build_object(
      'type', 'object',
      'properties',
        COALESCE("attribute_schema"->'properties', '{}'::jsonb)
        || jsonb_build_object(
             lower(regexp_replace("axis_label", '[^A-Za-z0-9]+', '_', 'g')),
             jsonb_build_object('type', 'string', 'title', "axis_label", 'enum', to_jsonb("axis_values"))
           ),
      'required', COALESCE("attribute_schema"->'required', '[]'::jsonb),
      'x-order',
        COALESCE("attribute_schema"->'x-order', '[]'::jsonb)
        || to_jsonb(lower(regexp_replace("axis_label", '[^A-Za-z0-9]+', '_', 'g')))
    )
WHERE "axis_label" IS NOT NULL;

ALTER TABLE "variant_types" ADD COLUMN "axis_key" TEXT;
UPDATE "variant_types"
SET "axis_key" = lower(regexp_replace("axis_label", '[^A-Za-z0-9]+', '_', 'g'))
WHERE "axis_label" IS NOT NULL;
ALTER TABLE "variant_types" DROP COLUMN "axis_label", DROP COLUMN "axis_values";

ALTER TABLE "products" DROP CONSTRAINT "products_product_type_id_fkey";
DROP INDEX "products_tenant_id_product_type_id_idx";
ALTER TABLE "products" DROP COLUMN "product_type_id";
DROP TABLE "product_types";
