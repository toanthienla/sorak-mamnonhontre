-- Position separate from role. Cán bộ profile lives on accounts. Drop teacher_profiles.

-- accounts: role nullable + add position
ALTER TABLE "accounts" ALTER COLUMN "role_id" DROP NOT NULL;
ALTER TABLE "accounts" ADD COLUMN "position" VARCHAR(100);

-- backfill position from existing roles
UPDATE "accounts" SET "position" = 'Giáo viên' WHERE account_id IN
  (SELECT account_id FROM "teacher_profiles");
UPDATE "accounts" SET "position" = 'Hiệu trưởng'
  WHERE position IS NULL AND role_id = (SELECT role_id FROM "roles" WHERE role_name = 'BGH');

-- teacher_classes: switch FK from teacher_profile_id to account_id
ALTER TABLE "teacher_classes" ADD COLUMN "account_id" INTEGER;
UPDATE "teacher_classes" tc SET "account_id" = tp.account_id
  FROM "teacher_profiles" tp WHERE tp.teacher_profile_id = tc.teacher_profile_id;
ALTER TABLE "teacher_classes" ALTER COLUMN "account_id" SET NOT NULL;
ALTER TABLE "teacher_classes" DROP CONSTRAINT IF EXISTS "teacher_classes_teacher_profile_id_fkey";
DROP INDEX IF EXISTS "teacher_classes_teacher_profile_id_class_id_key";
ALTER TABLE "teacher_classes" DROP COLUMN "teacher_profile_id";
ALTER TABLE "teacher_classes" ADD CONSTRAINT "teacher_classes_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "accounts"("account_id");
CREATE UNIQUE INDEX "teacher_classes_account_id_class_id_key" ON "teacher_classes"("account_id","class_id");

-- drop teacher_profiles (teacher_code + table gone)
DROP TABLE "teacher_profiles";

-- students: add is_active for account-level (separate from student_status)
ALTER TABLE "students" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
