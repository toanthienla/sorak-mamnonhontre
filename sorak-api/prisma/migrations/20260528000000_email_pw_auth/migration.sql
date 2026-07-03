-- Switch auth: BGH/GV email+password, PH student_card+password.
ALTER TABLE "accounts" ADD COLUMN "password_hash" VARCHAR(255);
ALTER TABLE "students" ADD COLUMN "password_hash" VARCHAR(255);

-- Phone no longer login identifier (email is). Drop unique.
DROP INDEX IF EXISTS "accounts_phone_key";
