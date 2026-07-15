-- CreateTable
CREATE TABLE "assessment_subjects" (
    "assessment_subject_id" SERIAL NOT NULL,
    "development_field_id" INTEGER NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "assessment_subjects_pkey" PRIMARY KEY ("assessment_subject_id")
);

-- CreateTable
CREATE TABLE "assessment_themes" (
    "assessment_theme_id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "assessment_themes_pkey" PRIMARY KEY ("assessment_theme_id")
);

-- CreateTable
CREATE TABLE "assessment_topics" (
    "assessment_topic_id" SERIAL NOT NULL,
    "assessment_theme_id" INTEGER NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "assessment_topics_pkey" PRIMARY KEY ("assessment_topic_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assessment_subjects_development_field_id_name_key" ON "assessment_subjects"("development_field_id", "name");

-- CreateIndex
CREATE INDEX "assessment_subjects_development_field_id_idx" ON "assessment_subjects"("development_field_id");

-- CreateIndex
CREATE INDEX "assessment_subjects_is_active_idx" ON "assessment_subjects"("is_active");

-- CreateIndex
CREATE INDEX "assessment_subjects_deleted_at_idx" ON "assessment_subjects"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_themes_name_key" ON "assessment_themes"("name");

-- CreateIndex
CREATE INDEX "assessment_themes_is_active_idx" ON "assessment_themes"("is_active");

-- CreateIndex
CREATE INDEX "assessment_themes_deleted_at_idx" ON "assessment_themes"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_topics_assessment_theme_id_name_key" ON "assessment_topics"("assessment_theme_id", "name");

-- CreateIndex
CREATE INDEX "assessment_topics_assessment_theme_id_idx" ON "assessment_topics"("assessment_theme_id");

-- CreateIndex
CREATE INDEX "assessment_topics_is_active_idx" ON "assessment_topics"("is_active");

-- CreateIndex
CREATE INDEX "assessment_topics_deleted_at_idx" ON "assessment_topics"("deleted_at");

-- AddForeignKey
ALTER TABLE "assessment_subjects" ADD CONSTRAINT "assessment_subjects_development_field_id_fkey" FOREIGN KEY ("development_field_id") REFERENCES "development_fields"("development_field_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_topics" ADD CONSTRAINT "assessment_topics_assessment_theme_id_fkey" FOREIGN KEY ("assessment_theme_id") REFERENCES "assessment_themes"("assessment_theme_id") ON DELETE RESTRICT ON UPDATE CASCADE;
