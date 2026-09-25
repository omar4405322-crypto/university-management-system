-- Step 1: Permanently delete legacy unscoped ADMIN account(s) or placeholder admin@university.com
DELETE FROM "User"
WHERE ("role" = 'ADMIN' AND "collegeId" IS NULL AND "managedCollegeId" IS NULL AND "departmentId" IS NULL AND "managedDepartmentId" IS NULL)
   OR ("role" = 'ADMIN' AND "email" = 'admin@university.com');

-- Step 2: Add database-level CHECK constraint enforcing that any ADMIN-role account must have an assigned college or department
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_must_have_scope'
  ) THEN
    ALTER TABLE "User"
      ADD CONSTRAINT "admin_must_have_scope"
      CHECK (
        "role" != 'ADMIN'
        OR "managedCollegeId" IS NOT NULL
        OR "collegeId" IS NOT NULL
        OR "managedDepartmentId" IS NOT NULL
        OR "departmentId" IS NOT NULL
      );
  END IF;
END $$;
