CREATE TABLE "assessment_age_groups" (
    "assessment_age_group_id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_en" VARCHAR(100) NOT NULL,
    "name_vi" VARCHAR(100) NOT NULL,
    "class_group_label" VARCHAR(30) NOT NULL,
    "display_order" INTEGER NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "assessment_age_groups_pkey" PRIMARY KEY ("assessment_age_group_id")
);

CREATE TABLE "development_fields" (
    "development_field_id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_en" VARCHAR(100) NOT NULL,
    "name_vi" VARCHAR(100) NOT NULL,
    "display_order" INTEGER NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "development_fields_pkey" PRIMARY KEY ("development_field_id")
);

CREATE UNIQUE INDEX "assessment_age_groups_code_key"
    ON "assessment_age_groups"("code");
CREATE UNIQUE INDEX "assessment_age_groups_class_group_label_key"
    ON "assessment_age_groups"("class_group_label");
CREATE INDEX "assessment_age_groups_deleted_at_idx"
    ON "assessment_age_groups"("deleted_at");
CREATE INDEX "assessment_age_groups_display_order_idx"
    ON "assessment_age_groups"("display_order");

CREATE UNIQUE INDEX "development_fields_code_key"
    ON "development_fields"("code");
CREATE INDEX "development_fields_deleted_at_idx"
    ON "development_fields"("deleted_at");
CREATE INDEX "development_fields_display_order_idx"
    ON "development_fields"("display_order");
