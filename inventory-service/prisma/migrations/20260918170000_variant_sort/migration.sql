-- Variants keep the order they were entered in.
ALTER TABLE "variants" ADD COLUMN "sort" INTEGER NOT NULL DEFAULT 0;
