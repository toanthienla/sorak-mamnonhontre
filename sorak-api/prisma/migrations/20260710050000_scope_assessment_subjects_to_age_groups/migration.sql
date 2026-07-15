ALTER TABLE "assessment_subjects" ADD COLUMN IF NOT EXISTS "assessment_age_group_id" INTEGER;
DROP INDEX IF EXISTS "assessment_subjects_development_field_id_name_key";

DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM "assessment_topics" topic
  WHERE topic."deleted_at" IS NULL AND topic."assessment_age_group_id" IS NULL;
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Không thể tách môn học: có % đề tài chưa xác định nhóm tuổi.', invalid_count;
  END IF;

  SELECT COUNT(*) INTO invalid_count
  FROM "assessment_criteria" criterion
  JOIN "assessment_topics" topic ON topic."assessment_topic_id" = criterion."assessment_topic_id"
  WHERE criterion."deleted_at" IS NULL
    AND (
      topic."deleted_at" IS NOT NULL
      OR criterion."assessment_subject_id" <> topic."assessment_subject_id"
      OR criterion."assessment_age_group_id" <> topic."assessment_age_group_id"
      OR criterion."assessment_theme_id" <> topic."assessment_theme_id"
    );
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Không thể tách môn học: có % tiêu chí có đường dẫn phân loại không nhất quán.', invalid_count;
  END IF;
END $$;

CREATE TEMP TABLE "subject_age_remap" (
  "old_subject_id" INTEGER NOT NULL,
  "assessment_age_group_id" INTEGER NOT NULL,
  "new_subject_id" INTEGER NOT NULL,
  PRIMARY KEY ("old_subject_id", "assessment_age_group_id")
) ON COMMIT DROP;

DO $$
DECLARE
  subject_record RECORD;
  age_record RECORD;
  primary_age_group_id INTEGER;
  target_subject_id INTEGER;
BEGIN
  FOR subject_record IN
    SELECT * FROM "assessment_subjects" WHERE "deleted_at" IS NULL ORDER BY "assessment_subject_id"
  LOOP
    primary_age_group_id := NULL;
    FOR age_record IN
      SELECT DISTINCT "assessment_age_group_id"
      FROM "assessment_topics"
      WHERE "assessment_subject_id" = subject_record."assessment_subject_id" AND "deleted_at" IS NULL
      ORDER BY "assessment_age_group_id"
    LOOP
      IF primary_age_group_id IS NULL THEN
        primary_age_group_id := age_record."assessment_age_group_id";
        UPDATE "assessment_subjects"
        SET "assessment_age_group_id" = primary_age_group_id
        WHERE "assessment_subject_id" = subject_record."assessment_subject_id";
        target_subject_id := subject_record."assessment_subject_id";
      ELSE
        INSERT INTO "assessment_subjects" (
          "assessment_age_group_id", "development_field_id", "name", "description", "is_active", "created_by", "updated_by", "created_at", "updated_at", "deleted_at"
        ) VALUES (
          age_record."assessment_age_group_id", subject_record."development_field_id", subject_record."name", subject_record."description", subject_record."is_active", subject_record."created_by", subject_record."updated_by", subject_record."created_at", subject_record."updated_at", subject_record."deleted_at"
        ) RETURNING "assessment_subject_id" INTO target_subject_id;
      END IF;
      INSERT INTO "subject_age_remap" ("old_subject_id", "assessment_age_group_id", "new_subject_id")
      VALUES (subject_record."assessment_subject_id", age_record."assessment_age_group_id", target_subject_id);
    END LOOP;
  END LOOP;
END $$;

CREATE TEMP TABLE "theme_subject_age_remap" (
  "old_theme_id" INTEGER NOT NULL,
  "assessment_age_group_id" INTEGER NOT NULL,
  "new_theme_id" INTEGER NOT NULL,
  PRIMARY KEY ("old_theme_id", "assessment_age_group_id")
) ON COMMIT DROP;

INSERT INTO "theme_subject_age_remap" ("old_theme_id", "assessment_age_group_id", "new_theme_id")
SELECT theme."assessment_theme_id", remap."assessment_age_group_id", theme."assessment_theme_id"
FROM "assessment_themes" theme
JOIN "subject_age_remap" remap ON remap."old_subject_id" = theme."assessment_subject_id"
WHERE remap."new_subject_id" = remap."old_subject_id";

DO $$
DECLARE
  remap_record RECORD;
  theme_record RECORD;
  target_theme_id INTEGER;
BEGIN
  FOR remap_record IN
    SELECT * FROM "subject_age_remap" WHERE "new_subject_id" <> "old_subject_id"
  LOOP
    FOR theme_record IN
      SELECT * FROM "assessment_themes" WHERE "assessment_subject_id" = remap_record."old_subject_id"
    LOOP
      INSERT INTO "assessment_themes" (
        "assessment_subject_id", "name", "description", "is_active", "created_by", "updated_by", "created_at", "updated_at", "deleted_at"
      ) VALUES (
        remap_record."new_subject_id", theme_record."name", theme_record."description", theme_record."is_active", theme_record."created_by", theme_record."updated_by", theme_record."created_at", theme_record."updated_at", theme_record."deleted_at"
      ) RETURNING "assessment_theme_id" INTO target_theme_id;
      INSERT INTO "theme_subject_age_remap" ("old_theme_id", "assessment_age_group_id", "new_theme_id")
      VALUES (theme_record."assessment_theme_id", remap_record."assessment_age_group_id", target_theme_id);
    END LOOP;
  END LOOP;
END $$;

UPDATE "assessment_topics" topic
SET "assessment_subject_id" = subject_remap."new_subject_id",
    "assessment_theme_id" = theme_remap."new_theme_id"
FROM "subject_age_remap" subject_remap
JOIN "theme_subject_age_remap" theme_remap
  ON theme_remap."assessment_age_group_id" = subject_remap."assessment_age_group_id"
WHERE topic."assessment_subject_id" = subject_remap."old_subject_id"
  AND topic."assessment_age_group_id" = subject_remap."assessment_age_group_id"
  AND topic."assessment_theme_id" = theme_remap."old_theme_id";

UPDATE "assessment_criteria" criterion
SET "assessment_subject_id" = subject_remap."new_subject_id",
    "assessment_theme_id" = theme_remap."new_theme_id"
FROM "subject_age_remap" subject_remap
JOIN "theme_subject_age_remap" theme_remap
  ON theme_remap."assessment_age_group_id" = subject_remap."assessment_age_group_id"
WHERE criterion."assessment_subject_id" = subject_remap."old_subject_id"
  AND criterion."assessment_age_group_id" = subject_remap."assessment_age_group_id"
  AND criterion."assessment_theme_id" = theme_remap."old_theme_id";

UPDATE "academic_year_timetable_items" item
SET "subject_id" = remap."new_subject_id"
FROM "academic_year_timetables" timetable
JOIN "subject_age_remap" remap ON remap."assessment_age_group_id" = timetable."age_group_id"
WHERE item."timetable_id" = timetable."timetable_id"
  AND item."subject_id" = remap."old_subject_id";

UPDATE "weekly_development_plan_activities" activity
SET "subject_id" = remap."new_subject_id"
FROM "weekly_development_plans" plan
JOIN "subject_age_remap" remap ON remap."assessment_age_group_id" = plan."age_group_id"
WHERE activity."weekly_development_plan_id" = plan."weekly_development_plan_id"
  AND activity."subject_id" = remap."old_subject_id";

UPDATE "weekly_development_plan_activity_criteria" mapping
SET "subject_id" = criterion."assessment_subject_id",
    "theme_id" = criterion."assessment_theme_id"
FROM "assessment_criteria" criterion
WHERE mapping."criterion_id" = criterion."assessment_criterion_id";

UPDATE "monthly_development_plan_themes" link
SET "theme_id" = theme_remap."new_theme_id"
FROM "monthly_theme_plans" plan
JOIN "theme_subject_age_remap" theme_remap ON theme_remap."assessment_age_group_id" = plan."age_group_id"
WHERE link."monthly_theme_plan_id" = plan."monthly_theme_plan_id"
  AND link."theme_id" = theme_remap."old_theme_id";

UPDATE "assessment_content_addition_requests" request
SET "subject_id" = subject_remap."new_subject_id",
    "theme_id" = COALESCE(
      (
        SELECT theme_remap."new_theme_id"
        FROM "theme_subject_age_remap" theme_remap
        WHERE theme_remap."assessment_age_group_id" = subject_remap."assessment_age_group_id"
          AND theme_remap."old_theme_id" = request."theme_id"
      ),
      request."theme_id"
    )
FROM "subject_age_remap" subject_remap
WHERE request."subject_id" = subject_remap."old_subject_id"
  AND request."age_group_id" = subject_remap."assessment_age_group_id";

ALTER TABLE "assessment_subjects"
  ADD CONSTRAINT "assessment_subjects_assessment_age_group_id_fkey"
  FOREIGN KEY ("assessment_age_group_id") REFERENCES "assessment_age_groups"("assessment_age_group_id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "assessment_subjects_assessment_age_group_id_idx" ON "assessment_subjects"("assessment_age_group_id");
CREATE UNIQUE INDEX "assessment_subjects_scope_normalized_name_key"
  ON "assessment_subjects" ("assessment_age_group_id", "development_field_id", LOWER(BTRIM("name")))
  WHERE "deleted_at" IS NULL AND "assessment_age_group_id" IS NOT NULL;
