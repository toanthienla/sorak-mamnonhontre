-- Option 2: shared profile fields live on accounts; teacher_profiles keeps only teacher-specific data.
-- Backfill existing GV account rows from their teacher_profiles before dropping the columns.
UPDATE "accounts" a
SET
  "date_of_birth"   = tp."date_of_birth",
  "gender"          = COALESCE(a."gender", tp."gender"),
  "address"         = tp."address",
  "work_start_date" = tp."work_start_date",
  "qualification"   = tp."qualification"
FROM "teacher_profiles" tp
WHERE tp."account_id" = a."account_id";

-- Remove moved columns from teacher_profiles (now only teacher_code + class links remain).
ALTER TABLE "teacher_profiles" DROP COLUMN "date_of_birth";
ALTER TABLE "teacher_profiles" DROP COLUMN "gender";
ALTER TABLE "teacher_profiles" DROP COLUMN "address";
ALTER TABLE "teacher_profiles" DROP COLUMN "work_start_date";
ALTER TABLE "teacher_profiles" DROP COLUMN "qualification";
