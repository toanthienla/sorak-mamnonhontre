-- CreateTable
CREATE TABLE "assessment_criteria" (
    "assessment_criterion_id" SERIAL NOT NULL,
    "criterion_code" VARCHAR(30) NOT NULL,
    "assessment_age_group_id" INTEGER NOT NULL,
    "development_field_id" INTEGER NOT NULL,
    "assessment_subject_id" INTEGER NOT NULL,
    "assessment_theme_id" INTEGER NOT NULL,
    "assessment_topic_id" INTEGER NOT NULL,
    "content" VARCHAR(1000) NOT NULL,
    "description" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "assessment_criteria_pkey" PRIMARY KEY ("assessment_criterion_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assessment_criteria_criterion_code_key" ON "assessment_criteria"("criterion_code");

-- CreateIndex
CREATE INDEX "assessment_criteria_assessment_age_group_id_idx" ON "assessment_criteria"("assessment_age_group_id");

-- CreateIndex
CREATE INDEX "assessment_criteria_development_field_id_idx" ON "assessment_criteria"("development_field_id");

-- CreateIndex
CREATE INDEX "assessment_criteria_assessment_subject_id_idx" ON "assessment_criteria"("assessment_subject_id");

-- CreateIndex
CREATE INDEX "assessment_criteria_assessment_theme_id_idx" ON "assessment_criteria"("assessment_theme_id");

-- CreateIndex
CREATE INDEX "assessment_criteria_assessment_topic_id_idx" ON "assessment_criteria"("assessment_topic_id");

-- CreateIndex
CREATE INDEX "assessment_criteria_is_active_idx" ON "assessment_criteria"("is_active");

-- CreateIndex
CREATE INDEX "assessment_criteria_deleted_at_idx" ON "assessment_criteria"("deleted_at");

-- CreateIndex
CREATE INDEX "assessment_criteria_classification_idx" ON "assessment_criteria"("assessment_age_group_id", "development_field_id", "assessment_subject_id", "assessment_theme_id", "assessment_topic_id");

-- AddForeignKey
ALTER TABLE "assessment_criteria" ADD CONSTRAINT "assessment_criteria_assessment_age_group_id_fkey" FOREIGN KEY ("assessment_age_group_id") REFERENCES "assessment_age_groups"("assessment_age_group_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_criteria" ADD CONSTRAINT "assessment_criteria_development_field_id_fkey" FOREIGN KEY ("development_field_id") REFERENCES "development_fields"("development_field_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_criteria" ADD CONSTRAINT "assessment_criteria_assessment_subject_id_fkey" FOREIGN KEY ("assessment_subject_id") REFERENCES "assessment_subjects"("assessment_subject_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_criteria" ADD CONSTRAINT "assessment_criteria_assessment_theme_id_fkey" FOREIGN KEY ("assessment_theme_id") REFERENCES "assessment_themes"("assessment_theme_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_criteria" ADD CONSTRAINT "assessment_criteria_assessment_topic_id_fkey" FOREIGN KEY ("assessment_topic_id") REFERENCES "assessment_topics"("assessment_topic_id") ON DELETE RESTRICT ON UPDATE CASCADE;
