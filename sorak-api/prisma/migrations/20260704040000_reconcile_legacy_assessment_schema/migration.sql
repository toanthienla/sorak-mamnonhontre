DO $$
DECLARE
  has_legacy_age_groups BOOLEAN;
  legacy_rows BIGINT;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'assessment_age_groups'
      AND column_name = 'age_group_id'
  ) INTO has_legacy_age_groups;

  IF NOT has_legacy_age_groups THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(row_count), 0)
  INTO legacy_rows
  FROM (
    SELECT COUNT(*) AS row_count FROM assessment_subjects
    UNION ALL SELECT COUNT(*) FROM assessment_themes
    UNION ALL SELECT COUNT(*) FROM assessment_topics
    UNION ALL SELECT COUNT(*) FROM assessment_criteria
    UNION ALL SELECT COUNT(*) FROM assessment_content_addition_requests
    UNION ALL SELECT COUNT(*) FROM weekly_development_plans
  ) counts;

  IF legacy_rows > 0 THEN
    RAISE EXCEPTION 'Legacy assessment tables contain data and require a dedicated data migration.';
  END IF;

  ALTER TABLE assessment_age_groups RENAME COLUMN age_group_id TO assessment_age_group_id;
  ALTER TABLE assessment_age_groups RENAME COLUMN name TO name_vi;
  ALTER TABLE assessment_age_groups RENAME COLUMN class_group TO class_group_label;
  ALTER TABLE assessment_age_groups ADD COLUMN name_en VARCHAR(100);
  UPDATE assessment_age_groups SET name_en = name_vi WHERE name_en IS NULL;
  ALTER TABLE assessment_age_groups ALTER COLUMN name_en SET NOT NULL;
  ALTER TABLE assessment_age_groups ADD COLUMN deleted_at TIMESTAMP(3);
  ALTER TABLE assessment_age_groups DROP COLUMN is_active;

  ALTER TABLE development_fields RENAME COLUMN name TO name_vi;
  ALTER TABLE development_fields ADD COLUMN name_en VARCHAR(100);
  UPDATE development_fields SET name_en = name_vi WHERE name_en IS NULL;
  ALTER TABLE development_fields ALTER COLUMN name_en SET NOT NULL;
  ALTER TABLE development_fields ADD COLUMN deleted_at TIMESTAMP(3);
  ALTER TABLE development_fields DROP COLUMN is_active;

  CREATE UNIQUE INDEX IF NOT EXISTS assessment_age_groups_class_group_label_key
    ON assessment_age_groups (class_group_label);
  CREATE INDEX IF NOT EXISTS assessment_age_groups_deleted_at_idx
    ON assessment_age_groups (deleted_at);
  CREATE INDEX IF NOT EXISTS assessment_age_groups_display_order_idx
    ON assessment_age_groups (display_order);
  CREATE INDEX IF NOT EXISTS development_fields_deleted_at_idx
    ON development_fields (deleted_at);
  CREATE INDEX IF NOT EXISTS development_fields_display_order_idx
    ON development_fields (display_order);

  DROP TABLE assessment_content_addition_requests CASCADE;
  DROP TABLE assessment_criteria CASCADE;
  DROP TABLE assessment_topics CASCADE;
  DROP TABLE assessment_themes CASCADE;
  DROP TABLE assessment_subjects CASCADE;
  DROP TABLE weekly_development_plans CASCADE;
END $$;
