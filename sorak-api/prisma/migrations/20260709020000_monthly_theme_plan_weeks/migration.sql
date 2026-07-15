ALTER TABLE "monthly_theme_plans" ADD COLUMN IF NOT EXISTS "planning_year" INTEGER;
ALTER TABLE "monthly_theme_plans" ADD COLUMN IF NOT EXISTS "planning_month" INTEGER;

UPDATE "monthly_theme_plans"
SET
  "planning_year" = COALESCE("planning_year", EXTRACT(YEAR FROM "expected_start_date")::INTEGER),
  "planning_month" = COALESCE("planning_month", EXTRACT(MONTH FROM "expected_start_date")::INTEGER)
WHERE "planning_year" IS NULL OR "planning_month" IS NULL;

ALTER TABLE "monthly_theme_plans" ALTER COLUMN "planning_year" SET NOT NULL;
ALTER TABLE "monthly_theme_plans" ALTER COLUMN "planning_month" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "monthly_theme_plan_weeks" (
  "monthly_theme_plan_week_id" SERIAL PRIMARY KEY,
  "monthly_theme_plan_id" INTEGER NOT NULL,
  "week_number" INTEGER NOT NULL,
  "start_date" TIMESTAMP(3) NOT NULL,
  "end_date" TIMESTAMP(3) NOT NULL,
  "display_range" VARCHAR(30) NOT NULL,
  "parity" VARCHAR(10) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "monthly_theme_plan_weeks_plan_id_fkey" FOREIGN KEY ("monthly_theme_plan_id")
    REFERENCES "monthly_theme_plans"("monthly_theme_plan_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "monthly_theme_plan_weeks_plan_week_unique"
  ON "monthly_theme_plan_weeks"("monthly_theme_plan_id", "week_number");
CREATE INDEX IF NOT EXISTS "monthly_theme_plan_weeks_plan_id_idx"
  ON "monthly_theme_plan_weeks"("monthly_theme_plan_id");
CREATE INDEX IF NOT EXISTS "monthly_theme_plans_planning_year_month_idx"
  ON "monthly_theme_plans"("planning_year", "planning_month");

INSERT INTO "monthly_theme_plan_weeks" (
  "monthly_theme_plan_id",
  "week_number",
  "start_date",
  "end_date",
  "display_range",
  "parity"
)
SELECT
  p."monthly_theme_plan_id",
  1,
  p."expected_start_date",
  p."expected_end_date",
  to_char(p."expected_start_date", 'DD/MM') || ' - ' || to_char(p."expected_end_date", 'DD/MM'),
  'ODD'
FROM "monthly_theme_plans" p
WHERE NOT EXISTS (
  SELECT 1
  FROM "monthly_theme_plan_weeks" w
  WHERE w."monthly_theme_plan_id" = p."monthly_theme_plan_id"
);

UPDATE "monthly_theme_plans"
SET "status" = 'READY'
WHERE "status" = 'IN_USE';
