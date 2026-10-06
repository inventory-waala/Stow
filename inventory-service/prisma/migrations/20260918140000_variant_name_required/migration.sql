-- Every variant must be named (the size/colour it represents). Existing rows
-- fall back to their SKU, then to "Default".
UPDATE "variants" SET "name" = COALESCE(NULLIF("sku", ''), 'Default') WHERE "name" IS NULL OR "name" = '';
ALTER TABLE "variants" ALTER COLUMN "name" SET NOT NULL;
