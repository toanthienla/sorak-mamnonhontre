ALTER TABLE "accounts"
ADD COLUMN IF NOT EXISTS "role" VARCHAR(20);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'role_id'
    ) THEN
        EXECUTE $sql$
            UPDATE "accounts"
            SET "role" = CASE
                WHEN "role_id" = 1 THEN 'PRINCIPAL'
                WHEN "role_id" = 2 THEN 'TEACHER'
                WHEN "role_id" = 3 THEN 'PARENT'
                ELSE 'TEACHER'
            END
            WHERE "role" IS NULL
        $sql$;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'position'
    ) THEN
        EXECUTE $sql$
            UPDATE "accounts"
            SET "role" = 'PRINCIPAL'
            WHERE "role" IS NULL
              AND lower(coalesce("position", '')) LIKE '%hiệu trưởng%'
        $sql$;
    END IF;
END $$;

UPDATE "accounts"
SET "role" = 'TEACHER'
WHERE "role" IS NULL;

ALTER TABLE "accounts"
ALTER COLUMN "role" SET DEFAULT 'TEACHER';

CREATE TABLE IF NOT EXISTS "teachers" (
    "teacher_id" SERIAL PRIMARY KEY,
    "account_id" INTEGER UNIQUE,
    "full_name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(150) NOT NULL UNIQUE,
    "phone" VARCHAR(20),
    "gender" VARCHAR(10),
    "date_of_birth" TIMESTAMP(3),
    "address" VARCHAR(500),
    "position" VARCHAR(100),
    "work_start_date" TIMESTAMP(3),
    "qualification" VARCHAR(255),
    "work_status" VARCHAR(50) NOT NULL DEFAULT 'Đang làm việc',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "teachers_deleted_at_idx" ON "teachers"("deleted_at");
CREATE INDEX IF NOT EXISTS "teachers_email_idx" ON "teachers"("email");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'teachers_account_id_fkey'
    ) THEN
        ALTER TABLE "teachers"
        ADD CONSTRAINT "teachers_account_id_fkey"
        FOREIGN KEY ("account_id") REFERENCES "accounts"("account_id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'email'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'full_name'
    ) THEN
        EXECUTE $sql$
            INSERT INTO "teachers" (
                account_id,
                full_name,
                email,
                phone,
                gender,
                date_of_birth,
                address,
                position,
                work_start_date,
                qualification,
                deleted_at,
                created_at,
                updated_at
            )
            SELECT
                a.account_id,
                a.full_name,
                a.email,
                a.phone,
                a.gender,
                a.date_of_birth,
                a.address,
                a.position,
                a.work_start_date,
                a.qualification,
                a.deleted_at,
                a.created_at,
                a.updated_at
            FROM "accounts" a
            WHERE a.email IS NOT NULL
              AND coalesce(a.role, 'TEACHER') <> 'PARENT'
              AND NOT EXISTS (
                  SELECT 1 FROM "teachers" t
                  WHERE t.account_id = a.account_id OR t.email = a.email
              )
        $sql$;
    END IF;
END $$;

ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "accounts_role_id_fkey";
DROP INDEX IF EXISTS "accounts_email_key";
DROP INDEX IF EXISTS "accounts_role_id_idx";

ALTER TABLE "accounts"
DROP COLUMN IF EXISTS "full_name",
DROP COLUMN IF EXISTS "email",
DROP COLUMN IF EXISTS "phone",
DROP COLUMN IF EXISTS "gender",
DROP COLUMN IF EXISTS "date_of_birth",
DROP COLUMN IF EXISTS "address",
DROP COLUMN IF EXISTS "position",
DROP COLUMN IF EXISTS "work_start_date",
DROP COLUMN IF EXISTS "qualification",
DROP COLUMN IF EXISTS "role_id";

ALTER TABLE "accounts"
ALTER COLUMN "role" SET NOT NULL,
ALTER COLUMN "password_hash" SET NOT NULL;

DROP TABLE IF EXISTS "roles";

ALTER TABLE "students"
ADD COLUMN IF NOT EXISTS "account_id" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "students_account_id_key"
    ON "students"("account_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'students_account_id_fkey'
    ) THEN
        ALTER TABLE "students"
        ADD CONSTRAINT "students_account_id_fkey"
        FOREIGN KEY ("account_id") REFERENCES "accounts"("account_id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

ALTER TABLE "teacher_classes"
ADD COLUMN IF NOT EXISTS "teacher_id" INTEGER;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'teacher_classes' AND column_name = 'account_id'
    ) THEN
        EXECUTE $sql$
            UPDATE "teacher_classes" tc
            SET "teacher_id" = t.teacher_id
            FROM "teachers" t
            WHERE tc.teacher_id IS NULL
              AND tc.account_id IS NOT NULL
              AND t.account_id = tc.account_id
        $sql$;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'teacher_classes_teacher_id_fkey'
    ) THEN
        ALTER TABLE "teacher_classes"
        ADD CONSTRAINT "teacher_classes_teacher_id_fkey"
        FOREIGN KEY ("teacher_id") REFERENCES "teachers"("teacher_id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "teacher_classes_teacher_id_class_id_key"
    ON "teacher_classes"("teacher_id", "class_id")
    WHERE "teacher_id" IS NOT NULL;
