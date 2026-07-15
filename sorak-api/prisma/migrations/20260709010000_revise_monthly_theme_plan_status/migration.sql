ALTER TABLE "monthly_theme_plans" ADD COLUMN IF NOT EXISTS "ready_by" INTEGER;
ALTER TABLE "monthly_theme_plans" ADD COLUMN IF NOT EXISTS "ready_at" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'monthly_theme_plans_ready_by_fkey'
  ) THEN
    ALTER TABLE "monthly_theme_plans"
      ADD CONSTRAINT "monthly_theme_plans_ready_by_fkey"
      FOREIGN KEY ("ready_by") REFERENCES "accounts"("account_id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "monthly_theme_plans_ready_by_idx" ON "monthly_theme_plans"("ready_by");

UPDATE "monthly_theme_plans"
SET "status" = 'READY'
WHERE "status" = 'IN_USE';
