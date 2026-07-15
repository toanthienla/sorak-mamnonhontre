CREATE TABLE "monthly_theme_plans" (
  "monthly_theme_plan_id" SERIAL PRIMARY KEY,
  "school_year_id" INTEGER NOT NULL,
  "class_id" INTEGER NOT NULL,
  "age_group_id" INTEGER NOT NULL,
  "name" VARCHAR(150) NOT NULL,
  "expected_start_date" TIMESTAMP(3) NOT NULL,
  "expected_end_date" TIMESTAMP(3) NOT NULL,
  "note" VARCHAR(500),
  "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  "created_by" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" INTEGER,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "monthly_theme_plans_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("school_year_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "monthly_theme_plans_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("class_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "monthly_theme_plans_age_group_id_fkey" FOREIGN KEY ("age_group_id") REFERENCES "assessment_age_groups"("assessment_age_group_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "monthly_theme_plans_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "accounts"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "monthly_theme_plans_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "accounts"("account_id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "monthly_development_plan_criteria" (
  "monthly_development_plan_criterion_id" SERIAL PRIMARY KEY,
  "monthly_theme_plan_id" INTEGER NOT NULL,
  "criterion_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "monthly_development_plan_criteria_plan_id_fkey" FOREIGN KEY ("monthly_theme_plan_id") REFERENCES "monthly_theme_plans"("monthly_theme_plan_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "monthly_development_plan_criteria_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "assessment_criteria"("assessment_criterion_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "monthly_development_plan_themes" (
  "monthly_development_plan_theme_id" SERIAL PRIMARY KEY,
  "monthly_theme_plan_id" INTEGER NOT NULL,
  "theme_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "monthly_development_plan_themes_plan_id_fkey" FOREIGN KEY ("monthly_theme_plan_id") REFERENCES "monthly_theme_plans"("monthly_theme_plan_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "monthly_development_plan_themes_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "assessment_themes"("assessment_theme_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "monthly_development_plan_topics" (
  "monthly_development_plan_topic_id" SERIAL PRIMARY KEY,
  "monthly_theme_plan_id" INTEGER NOT NULL,
  "topic_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "monthly_development_plan_topics_plan_id_fkey" FOREIGN KEY ("monthly_theme_plan_id") REFERENCES "monthly_theme_plans"("monthly_theme_plan_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "monthly_development_plan_topics_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "assessment_topics"("assessment_topic_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "monthly_development_plan_criteria_plan_criterion_uq"
  ON "monthly_development_plan_criteria"("monthly_theme_plan_id", "criterion_id");
CREATE UNIQUE INDEX "monthly_development_plan_themes_plan_theme_uq"
  ON "monthly_development_plan_themes"("monthly_theme_plan_id", "theme_id");
CREATE UNIQUE INDEX "monthly_development_plan_topics_plan_topic_uq"
  ON "monthly_development_plan_topics"("monthly_theme_plan_id", "topic_id");

CREATE INDEX "monthly_theme_plans_school_year_id_idx" ON "monthly_theme_plans"("school_year_id");
CREATE INDEX "monthly_theme_plans_class_id_idx" ON "monthly_theme_plans"("class_id");
CREATE INDEX "monthly_theme_plans_age_group_id_idx" ON "monthly_theme_plans"("age_group_id");
CREATE INDEX "monthly_theme_plans_status_idx" ON "monthly_theme_plans"("status");
CREATE INDEX "monthly_theme_plans_deleted_at_idx" ON "monthly_theme_plans"("deleted_at");
CREATE INDEX "monthly_development_plan_criteria_plan_id_idx" ON "monthly_development_plan_criteria"("monthly_theme_plan_id");
CREATE INDEX "monthly_development_plan_criteria_criterion_id_idx" ON "monthly_development_plan_criteria"("criterion_id");
CREATE INDEX "monthly_development_plan_themes_plan_id_idx" ON "monthly_development_plan_themes"("monthly_theme_plan_id");
CREATE INDEX "monthly_development_plan_themes_theme_id_idx" ON "monthly_development_plan_themes"("theme_id");
CREATE INDEX "monthly_development_plan_topics_plan_id_idx" ON "monthly_development_plan_topics"("monthly_theme_plan_id");
CREATE INDEX "monthly_development_plan_topics_topic_id_idx" ON "monthly_development_plan_topics"("topic_id");
