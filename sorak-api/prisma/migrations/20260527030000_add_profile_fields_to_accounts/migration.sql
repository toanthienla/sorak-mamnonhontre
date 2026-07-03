-- Add staff profile fields to accounts (BGH gets same profile shape as teacher)
ALTER TABLE "accounts" ADD COLUMN "date_of_birth" TIMESTAMP(3);
ALTER TABLE "accounts" ADD COLUMN "address" VARCHAR(500);
ALTER TABLE "accounts" ADD COLUMN "work_start_date" TIMESTAMP(3);
ALTER TABLE "accounts" ADD COLUMN "qualification" VARCHAR(255);
