-- Scope selected content/topics by age group and subject while preserving existing criteria.

ALTER TABLE "assessment_topics" ADD COLUMN "assessment_age_group_id" INTEGER;
ALTER TABLE "assessment_topics" ADD COLUMN "assessment_subject_id" INTEGER;

DO $$
DECLARE
  topic_row RECORD;
  scope_row RECORD;
  scoped_topic_id INTEGER;
  scope_index INTEGER;
BEGIN
  FOR topic_row IN
    SELECT *
    FROM "assessment_topics"
    WHERE "deleted_at" IS NULL
    ORDER BY "assessment_topic_id"
  LOOP
    scope_index := 0;

    FOR scope_row IN
      SELECT DISTINCT
        "assessment_age_group_id",
        "assessment_subject_id"
      FROM "assessment_criteria"
      WHERE "assessment_topic_id" = topic_row."assessment_topic_id"
        AND "deleted_at" IS NULL
      ORDER BY "assessment_age_group_id", "assessment_subject_id"
    LOOP
      scope_index := scope_index + 1;

      IF scope_index = 1 THEN
        UPDATE "assessment_topics"
        SET
          "assessment_age_group_id" = scope_row."assessment_age_group_id",
          "assessment_subject_id" = scope_row."assessment_subject_id"
        WHERE "assessment_topic_id" = topic_row."assessment_topic_id";

        scoped_topic_id := topic_row."assessment_topic_id";
      ELSE
        INSERT INTO "assessment_topics" (
          "assessment_theme_id",
          "assessment_age_group_id",
          "assessment_subject_id",
          "name",
          "description",
          "is_active",
          "created_by",
          "updated_by",
          "created_at",
          "updated_at",
          "deleted_at"
        )
        VALUES (
          topic_row."assessment_theme_id",
          scope_row."assessment_age_group_id",
          scope_row."assessment_subject_id",
          topic_row."name",
          topic_row."description",
          topic_row."is_active",
          topic_row."created_by",
          topic_row."updated_by",
          topic_row."created_at",
          CURRENT_TIMESTAMP,
          topic_row."deleted_at"
        )
        RETURNING "assessment_topic_id" INTO scoped_topic_id;

        UPDATE "assessment_criteria"
        SET "assessment_topic_id" = scoped_topic_id
        WHERE "assessment_topic_id" = topic_row."assessment_topic_id"
          AND "assessment_age_group_id" = scope_row."assessment_age_group_id"
          AND "assessment_subject_id" = scope_row."assessment_subject_id"
          AND "deleted_at" IS NULL;
      END IF;
    END LOOP;
  END LOOP;
END $$;

DROP INDEX IF EXISTS "assessment_topics_assessment_theme_id_name_key";

CREATE UNIQUE INDEX "assessment_topics_assessment_theme_id_assessment_age_group_id_assessment_subject_id_name_key"
  ON "assessment_topics"("assessment_theme_id", "assessment_age_group_id", "assessment_subject_id", "name");

CREATE INDEX "assessment_topics_assessment_age_group_id_idx"
  ON "assessment_topics"("assessment_age_group_id");

CREATE INDEX "assessment_topics_assessment_subject_id_idx"
  ON "assessment_topics"("assessment_subject_id");

ALTER TABLE "assessment_topics"
  ADD CONSTRAINT "assessment_topics_assessment_age_group_id_fkey"
  FOREIGN KEY ("assessment_age_group_id")
  REFERENCES "assessment_age_groups"("assessment_age_group_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_topics"
  ADD CONSTRAINT "assessment_topics_assessment_subject_id_fkey"
  FOREIGN KEY ("assessment_subject_id")
  REFERENCES "assessment_subjects"("assessment_subject_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
