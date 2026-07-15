DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM "assessment_topics" topic
  WHERE topic."deleted_at" IS NULL AND topic."assessment_subject_id" IS NULL;
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Không thể tách chủ đề: có % đề tài chưa xác định môn học.', invalid_count;
  END IF;

  SELECT COUNT(*) INTO invalid_count
  FROM "assessment_themes" theme
  WHERE theme."deleted_at" IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM "assessment_topics" topic
      WHERE topic."assessment_theme_id" = theme."assessment_theme_id" AND topic."deleted_at" IS NULL
    );
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Không thể tách chủ đề: có % chủ đề không có đề tài để xác định môn học.', invalid_count;
  END IF;

  SELECT COUNT(*) INTO invalid_count
  FROM "assessment_criteria" criterion
  JOIN "assessment_topics" topic ON topic."assessment_topic_id" = criterion."assessment_topic_id"
  WHERE criterion."deleted_at" IS NULL
    AND (
      topic."deleted_at" IS NOT NULL
      OR criterion."assessment_theme_id" <> topic."assessment_theme_id"
      OR criterion."assessment_subject_id" IS DISTINCT FROM topic."assessment_subject_id"
      OR criterion."assessment_age_group_id" IS DISTINCT FROM topic."assessment_age_group_id"
    );
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Không thể tách chủ đề: có % tiêu chí có đường dẫn phân loại không nhất quán.', invalid_count;
  END IF;
END $$;

CREATE TEMP TABLE "theme_subject_remap" (
  "old_theme_id" INTEGER NOT NULL,
  "assessment_subject_id" INTEGER NOT NULL,
  "new_theme_id" INTEGER NOT NULL,
  PRIMARY KEY ("old_theme_id", "assessment_subject_id")
) ON COMMIT DROP;

DO $$
DECLARE
  theme_record RECORD;
  subject_record RECORD;
  primary_subject_id INTEGER;
  target_theme_id INTEGER;
BEGIN
  FOR theme_record IN
    SELECT * FROM "assessment_themes" WHERE "deleted_at" IS NULL ORDER BY "assessment_theme_id"
  LOOP
    primary_subject_id := NULL;
    FOR subject_record IN
      SELECT DISTINCT "assessment_subject_id"
      FROM "assessment_topics"
      WHERE "assessment_theme_id" = theme_record."assessment_theme_id" AND "deleted_at" IS NULL
      ORDER BY "assessment_subject_id"
    LOOP
      IF primary_subject_id IS NULL THEN
        primary_subject_id := subject_record."assessment_subject_id";
        UPDATE "assessment_themes"
        SET "assessment_subject_id" = primary_subject_id
        WHERE "assessment_theme_id" = theme_record."assessment_theme_id";
        target_theme_id := theme_record."assessment_theme_id";
      ELSE
        INSERT INTO "assessment_themes" (
          "assessment_subject_id", "name", "description", "is_active", "created_by", "updated_by", "created_at", "updated_at", "deleted_at"
        ) VALUES (
          subject_record."assessment_subject_id", theme_record."name", theme_record."description", theme_record."is_active", theme_record."created_by", theme_record."updated_by", theme_record."created_at", theme_record."updated_at", theme_record."deleted_at"
        ) RETURNING "assessment_theme_id" INTO target_theme_id;
      END IF;
      INSERT INTO "theme_subject_remap" ("old_theme_id", "assessment_subject_id", "new_theme_id")
      VALUES (theme_record."assessment_theme_id", subject_record."assessment_subject_id", target_theme_id);
    END LOOP;
  END LOOP;
END $$;

UPDATE "assessment_topics" topic
SET "assessment_theme_id" = remap."new_theme_id"
FROM "theme_subject_remap" remap
WHERE topic."assessment_theme_id" = remap."old_theme_id"
  AND topic."assessment_subject_id" = remap."assessment_subject_id";

UPDATE "assessment_criteria" criterion
SET "assessment_theme_id" = remap."new_theme_id"
FROM "theme_subject_remap" remap
WHERE criterion."assessment_theme_id" = remap."old_theme_id"
  AND criterion."assessment_subject_id" = remap."assessment_subject_id";

INSERT INTO "monthly_development_plan_themes" ("monthly_theme_plan_id", "theme_id", "created_at")
SELECT DISTINCT link."monthly_theme_plan_id", topic."assessment_theme_id", link."created_at"
FROM "monthly_development_plan_themes" link
JOIN "monthly_development_plan_topics" plan_topic ON plan_topic."monthly_theme_plan_id" = link."monthly_theme_plan_id"
JOIN "assessment_topics" topic ON topic."assessment_topic_id" = plan_topic."topic_id"
ON CONFLICT ("monthly_theme_plan_id", "theme_id") DO NOTHING;

UPDATE "weekly_development_plan_activity_criteria" weekly_criterion
SET "theme_id" = criterion."assessment_theme_id"
FROM "assessment_criteria" criterion
WHERE criterion."assessment_criterion_id" = weekly_criterion."criterion_id";

UPDATE "assessment_content_addition_requests" request
SET "theme_id" = topic."assessment_theme_id"
FROM "assessment_topics" topic
WHERE request."topic_id" = topic."assessment_topic_id"
  AND request."theme_id" IS DISTINCT FROM topic."assessment_theme_id";

ALTER TABLE "assessment_themes" ALTER COLUMN "assessment_subject_id" SET NOT NULL;
ALTER TABLE "assessment_themes"
  ADD CONSTRAINT "assessment_themes_assessment_subject_id_fkey"
  FOREIGN KEY ("assessment_subject_id") REFERENCES "assessment_subjects"("assessment_subject_id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "assessment_themes_assessment_subject_id_idx" ON "assessment_themes"("assessment_subject_id");
CREATE UNIQUE INDEX "assessment_themes_subject_normalized_name_key"
  ON "assessment_themes" ("assessment_subject_id", LOWER(BTRIM("name")))
  WHERE "deleted_at" IS NULL;
