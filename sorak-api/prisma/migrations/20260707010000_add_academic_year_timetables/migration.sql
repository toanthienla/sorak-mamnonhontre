CREATE TABLE "academic_year_timetables" (
  "timetable_id" SERIAL PRIMARY KEY,
  "school_year_id" INTEGER NOT NULL,
  "age_group_id" INTEGER NOT NULL,
  "name" VARCHAR(150) NOT NULL,
  "description" VARCHAR(500),
  "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  "created_by" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_updated_by" INTEGER,
  "last_updated_at" TIMESTAMP(3),
  "change_reason" VARCHAR(1000),
  "locked_by" INTEGER,
  "locked_at" TIMESTAMP(3),
  "unlocked_by" INTEGER,
  "unlocked_at" TIMESTAMP(3),
  "unlock_reason" VARCHAR(1000),
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "academic_year_timetables_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("school_year_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "academic_year_timetables_age_group_id_fkey" FOREIGN KEY ("age_group_id") REFERENCES "assessment_age_groups"("assessment_age_group_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "academic_year_timetables_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "accounts"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "academic_year_timetables_last_updated_by_fkey" FOREIGN KEY ("last_updated_by") REFERENCES "accounts"("account_id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "academic_year_timetables_locked_by_fkey" FOREIGN KEY ("locked_by") REFERENCES "accounts"("account_id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "academic_year_timetables_unlocked_by_fkey" FOREIGN KEY ("unlocked_by") REFERENCES "accounts"("account_id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "academic_year_timetable_items" (
  "timetable_item_id" SERIAL PRIMARY KEY,
  "timetable_id" INTEGER NOT NULL,
  "week_pattern" VARCHAR(10) NOT NULL,
  "day_of_week" VARCHAR(10) NOT NULL,
  "session" VARCHAR(10) NOT NULL,
  "display_order" INTEGER NOT NULL,
  "activity_type" VARCHAR(30) NOT NULL,
  "subject_id" INTEGER,
  "activity_name" VARCHAR(150),
  "is_theme_based" BOOLEAN NOT NULL DEFAULT false,
  "is_assessable" BOOLEAN NOT NULL DEFAULT false,
  "requires_weekly_mapping" BOOLEAN NOT NULL DEFAULT false,
  "note" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "academic_year_timetable_items_timetable_id_fkey" FOREIGN KEY ("timetable_id") REFERENCES "academic_year_timetables"("timetable_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "academic_year_timetable_items_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "assessment_subjects"("assessment_subject_id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "academic_year_timetables_school_year_age_group_active_uq"
  ON "academic_year_timetables"("school_year_id", "age_group_id")
  WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "academic_year_timetable_items_slot_uq"
  ON "academic_year_timetable_items"("timetable_id", "week_pattern", "day_of_week", "session", "display_order");

CREATE INDEX "academic_year_timetables_school_year_id_idx" ON "academic_year_timetables"("school_year_id");
CREATE INDEX "academic_year_timetables_age_group_id_idx" ON "academic_year_timetables"("age_group_id");
CREATE INDEX "academic_year_timetables_status_idx" ON "academic_year_timetables"("status");
CREATE INDEX "academic_year_timetables_deleted_at_idx" ON "academic_year_timetables"("deleted_at");
CREATE INDEX "academic_year_timetable_items_timetable_id_idx" ON "academic_year_timetable_items"("timetable_id");
CREATE INDEX "academic_year_timetable_items_subject_id_idx" ON "academic_year_timetable_items"("subject_id");
