CREATE TABLE "daily_development_assessments" (
  "daily_development_assessment_id" SERIAL NOT NULL,
  "school_year_id" INTEGER NOT NULL,
  "class_id" INTEGER NOT NULL,
  "student_id" INTEGER NOT NULL,
  "weekly_development_plan_id" INTEGER NOT NULL,
  "weekly_development_plan_activity_id" INTEGER NOT NULL,
  "activity_date" TIMESTAMP(3) NOT NULL,
  "criterion_id" INTEGER NOT NULL,
  "result" VARCHAR(20) NOT NULL,
  "note" VARCHAR(500),
  "assessed_by" INTEGER NOT NULL,
  "assessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" INTEGER,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "daily_development_assessments_pkey" PRIMARY KEY ("daily_development_assessment_id")
);

CREATE UNIQUE INDEX "daily_development_assessments_student_id_weekly_development_plan_activity_id_criterion_id_key"
  ON "daily_development_assessments"("student_id", "weekly_development_plan_activity_id", "criterion_id");

CREATE INDEX "daily_development_assessments_school_year_id_idx" ON "daily_development_assessments"("school_year_id");
CREATE INDEX "daily_development_assessments_class_id_idx" ON "daily_development_assessments"("class_id");
CREATE INDEX "daily_development_assessments_weekly_development_plan_id_idx" ON "daily_development_assessments"("weekly_development_plan_id");
CREATE INDEX "daily_development_assessments_weekly_development_plan_activity_id_idx" ON "daily_development_assessments"("weekly_development_plan_activity_id");
CREATE INDEX "daily_development_assessments_criterion_id_idx" ON "daily_development_assessments"("criterion_id");
CREATE INDEX "daily_development_assessments_assessed_by_idx" ON "daily_development_assessments"("assessed_by");
CREATE INDEX "daily_development_assessments_deleted_at_idx" ON "daily_development_assessments"("deleted_at");

ALTER TABLE "daily_development_assessments"
  ADD CONSTRAINT "daily_development_assessments_school_year_id_fkey"
  FOREIGN KEY ("school_year_id") REFERENCES "school_years"("school_year_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "daily_development_assessments"
  ADD CONSTRAINT "daily_development_assessments_class_id_fkey"
  FOREIGN KEY ("class_id") REFERENCES "classes"("class_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "daily_development_assessments"
  ADD CONSTRAINT "daily_development_assessments_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("student_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "daily_development_assessments"
  ADD CONSTRAINT "daily_development_assessments_weekly_development_plan_id_fkey"
  FOREIGN KEY ("weekly_development_plan_id") REFERENCES "weekly_development_plans"("weekly_development_plan_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "daily_development_assessments"
  ADD CONSTRAINT "daily_development_assessments_weekly_development_plan_activity_id_fkey"
  FOREIGN KEY ("weekly_development_plan_activity_id") REFERENCES "weekly_development_plan_activities"("weekly_development_plan_activity_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "daily_development_assessments"
  ADD CONSTRAINT "daily_development_assessments_criterion_id_fkey"
  FOREIGN KEY ("criterion_id") REFERENCES "assessment_criteria"("assessment_criterion_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "daily_development_assessments"
  ADD CONSTRAINT "daily_development_assessments_assessed_by_fkey"
  FOREIGN KEY ("assessed_by") REFERENCES "accounts"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "daily_development_assessments"
  ADD CONSTRAINT "daily_development_assessments_updated_by_fkey"
  FOREIGN KEY ("updated_by") REFERENCES "accounts"("account_id") ON DELETE SET NULL ON UPDATE CASCADE;
