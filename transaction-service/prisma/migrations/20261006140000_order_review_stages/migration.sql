-- Adds the pricing gate justanidea ran orders through: raised, put in review
-- so the special discount can be settled, then approved before stock is
-- committed.
--
-- Placed BEFORE 'CONFIRMED' so the enum's declared order still reads as the
-- lifecycle order; Postgres appends otherwise. 'REVIEW' goes in first, then
-- 'APPROVED' before 'CONFIRMED', which lands it after 'REVIEW'.
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'REVIEW' BEFORE 'CONFIRMED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'APPROVED' BEFORE 'CONFIRMED';
