-- DB-001: Monetary Amount Float -> Decimal(12, 2) and CHECK (amount > 0)
-- DB-002: Composite Indexes on Payment(status, paidAt) and AttendanceSession(isActive, expiresAt)

-- Step 1: Pre-migration data verification check (fails safely if violating data exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Payment" WHERE "amount" IS NULL) THEN
    RAISE EXCEPTION 'Pre-migration check failed: Found NULL Payment amounts in database';
  END IF;
  IF EXISTS (SELECT 1 FROM "Payment" WHERE "amount" <= 0) THEN
    RAISE EXCEPTION 'Pre-migration check failed: Found non-positive Payment amounts in database';
  END IF;
  IF EXISTS (SELECT 1 FROM "Payment" WHERE ABS("amount"::numeric) >= 10000000000) THEN
    RAISE EXCEPTION 'Pre-migration check failed: Found Payment amounts exceeding DECIMAL(12, 2) range (>= 10^10)';
  END IF;
  IF EXISTS (SELECT 1 FROM "Payment" WHERE "amount"::numeric != ROUND("amount"::numeric, 2)) THEN
    RAISE EXCEPTION 'Pre-migration check failed: Found Payment amounts with >2 decimal places that would lose meaningful precision';
  END IF;
END $$;

-- Step 2: Convert column data type to DECIMAL(12, 2) with ROUND_HALF_UP equivalent
ALTER TABLE "Payment"
  ALTER COLUMN "amount" TYPE DECIMAL(12, 2)
  USING ROUND("amount"::numeric, 2);

-- Step 3: Enforce strict database-level CHECK constraint preventing zero or negative amounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_payment_amount_positive'
  ) THEN
    ALTER TABLE "Payment"
      ADD CONSTRAINT "chk_payment_amount_positive"
      CHECK ("amount" > 0);
  END IF;
END $$;

-- Step 4 (DB-002): Composite index for financial aggregations and range queries
CREATE INDEX IF NOT EXISTS "Payment_status_paidAt_idx"
  ON "Payment"("status", "paidAt");

-- Step 5 (DB-002): Composite index for minute-by-minute session expiry sweeps
CREATE INDEX IF NOT EXISTS "AttendanceSession_isActive_expiresAt_idx"
  ON "AttendanceSession"("isActive", "expiresAt");
