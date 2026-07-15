ALTER TABLE "assessment_themes" ADD COLUMN IF NOT EXISTS "assessment_subject_id" INTEGER;
ALTER TABLE "assessment_themes" DROP CONSTRAINT IF EXISTS "assessment_themes_name_key";
