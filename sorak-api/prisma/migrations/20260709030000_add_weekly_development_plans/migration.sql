CREATE TABLE IF NOT EXISTS "weekly_development_plans" (
  "weekly_development_plan_id" SERIAL PRIMARY KEY,
  "school_year_id" INTEGER NOT NULL,
  "class_id" INTEGER NOT NULL,
  "age_group_id" INTEGER NOT NULL,
  "monthly_theme_plan_id" INTEGER NOT NULL,
  "planning_year" INTEGER NOT NULL,
  "planning_month" INTEGER NOT NULL,
  "week_number" INTEGER NOT NULL,
  "start_date" TIMESTAMP(3) NOT NULL,
  "end_date" TIMESTAMP(3) NOT NULL,
  "display_range" VARCHAR(30) NOT NULL,
  "parity" VARCHAR(10) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  "note" VARCHAR(500),
  "created_by" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" INTEGER,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ready_by" INTEGER,
  "ready_at" TIMESTAMP(3),
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "weekly_development_plans_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("school_year_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "weekly_development_plans_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("class_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "weekly_development_plans_age_group_id_fkey" FOREIGN KEY ("age_group_id") REFERENCES "assessment_age_groups"("assessment_age_group_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "weekly_development_plans_monthly_theme_plan_id_fkey" FOREIGN KEY ("monthly_theme_plan_id") REFERENCES "monthly_theme_plans"("monthly_theme_plan_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "weekly_development_plans_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "accounts"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "weekly_development_plans_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "accounts"("account_id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "weekly_development_plans_ready_by_fkey" FOREIGN KEY ("ready_by") REFERENCES "accounts"("account_id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "weekly_development_plan_activities" (
  "weekly_development_plan_activity_id" SERIAL PRIMARY KEY,
  "weekly_development_plan_id" INTEGER NOT NULL,
  "source_timetable_item_id" INTEGER,
  "day_of_week" VARCHAR(10) NOT NULL,
  "activity_date" TIMESTAMP(3) NOT NULL,
  "session" VARCHAR(10) NOT NULL,
  "display_order" INTEGER NOT NULL,
  "activity_type" VARCHAR(30) NOT NULL,
  "subject_id" INTEGER,
  "subject_name_snapshot" VARCHAR(150),
  "development_field_id" INTEGER,
  "development_field_name_snapshot" VARCHAR(100),
  "activity_name_snapshot" VARCHAR(150),
  "note_snapshot" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "weekly_development_plan_activities_plan_id_fkey" FOREIGN KEY ("weekly_development_plan_id") REFERENCES "weekly_development_plans"("weekly_development_plan_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "weekly_development_plan_activity_criteria" (
  "weekly_development_plan_activity_criterion_id" SERIAL PRIMARY KEY,
  "weekly_development_plan_activity_id" INTEGER NOT NULL,
  "monthly_theme_plan_criterion_id" INTEGER NOT NULL,
  "criterion_id" INTEGER NOT NULL,
  "topic_id" INTEGER NOT NULL,
  "subject_id" INTEGER NOT NULL,
  "development_field_id" INTEGER NOT NULL,
  "theme_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "weekly_development_plan_activity_criteria_activity_id_fkey" FOREIGN KEY ("weekly_development_plan_activity_id") REFERENCES "weekly_development_plan_activities"("weekly_development_plan_activity_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "weekly_development_plan_activity_criteria_monthly_plan_criterion_id_fkey" FOREIGN KEY ("monthly_theme_plan_criterion_id") REFERENCES "monthly_development_plan_criteria"("monthly_development_plan_criterion_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "weekly_development_plan_activity_criteria_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "assessment_criteria"("assessment_criterion_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "weekly_development_plan_week_unique"
  ON "weekly_development_plans"("class_id", "school_year_id", "planning_year", "planning_month", "week_number", "deleted_at");
CREATE INDEX IF NOT EXISTS "weekly_development_plans_school_year_id_idx" ON "weekly_development_plans"("school_year_id");
CREATE INDEX IF NOT EXISTS "weekly_development_plans_class_id_idx" ON "weekly_development_plans"("class_id");
CREATE INDEX IF NOT EXISTS "weekly_development_plans_age_group_id_idx" ON "weekly_development_plans"("age_group_id");
CREATE INDEX IF NOT EXISTS "weekly_development_plans_monthly_theme_plan_id_idx" ON "weekly_development_plans"("monthly_theme_plan_id");
CREATE INDEX IF NOT EXISTS "weekly_development_plans_planning_week_idx" ON "weekly_development_plans"("planning_year", "planning_month", "week_number");
CREATE INDEX IF NOT EXISTS "weekly_development_plans_status_idx" ON "weekly_development_plans"("status");
CREATE INDEX IF NOT EXISTS "weekly_development_plans_deleted_at_idx" ON "weekly_development_plans"("deleted_at");

CREATE INDEX IF NOT EXISTS "weekly_development_plan_activities_plan_id_idx" ON "weekly_development_plan_activities"("weekly_development_plan_id");
CREATE INDEX IF NOT EXISTS "weekly_development_plan_activities_source_item_idx" ON "weekly_development_plan_activities"("source_timetable_item_id");
CREATE INDEX IF NOT EXISTS "weekly_development_plan_activities_day_session_idx" ON "weekly_development_plan_activities"("day_of_week", "session");

CREATE UNIQUE INDEX IF NOT EXISTS "weekly_development_plan_activity_criteria_activity_criterion_unique"
  ON "weekly_development_plan_activity_criteria"("weekly_development_plan_activity_id", "criterion_id");
CREATE INDEX IF NOT EXISTS "weekly_development_plan_activity_criteria_activity_id_idx" ON "weekly_development_plan_activity_criteria"("weekly_development_plan_activity_id");
CREATE INDEX IF NOT EXISTS "weekly_development_plan_activity_criteria_monthly_plan_criterion_id_idx" ON "weekly_development_plan_activity_criteria"("monthly_theme_plan_criterion_id");
CREATE INDEX IF NOT EXISTS "weekly_development_plan_activity_criteria_criterion_id_idx" ON "weekly_development_plan_activity_criteria"("criterion_id");
