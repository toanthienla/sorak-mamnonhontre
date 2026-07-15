CREATE TABLE "assessment_content_addition_requests" (
    "request_id" SERIAL NOT NULL,
    "request_code" VARCHAR(30) NOT NULL,
    "request_type" VARCHAR(30) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "proposed_name" VARCHAR(150),
    "proposed_description" VARCHAR(500),
    "proposed_reason" VARCHAR(1000),
    "proposed_criteria" JSONB,
    "age_group_id" INTEGER,
    "development_field_id" INTEGER,
    "subject_id" INTEGER,
    "theme_id" INTEGER,
    "topic_id" INTEGER,
    "criterion_id" INTEGER,
    "requester_id" INTEGER NOT NULL,
    "requester_teacher_id" INTEGER NOT NULL,
    "requester_class_id" INTEGER,
    "reviewed_by" INTEGER,
    "reviewed_at" TIMESTAMP(3),
    "review_note" VARCHAR(1000),
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_content_addition_requests_pkey" PRIMARY KEY ("request_id")
);

CREATE UNIQUE INDEX "assessment_content_addition_requests_request_code_key" ON "assessment_content_addition_requests"("request_code");
CREATE INDEX "assessment_content_addition_requests_request_type_idx" ON "assessment_content_addition_requests"("request_type");
CREATE INDEX "assessment_content_addition_requests_status_idx" ON "assessment_content_addition_requests"("status");
CREATE INDEX "assessment_content_addition_requests_requester_id_idx" ON "assessment_content_addition_requests"("requester_id");
CREATE INDEX "assessment_content_addition_requests_requester_teacher_id_idx" ON "assessment_content_addition_requests"("requester_teacher_id");
CREATE INDEX "assessment_content_addition_requests_requester_class_id_idx" ON "assessment_content_addition_requests"("requester_class_id");
CREATE INDEX "assessment_content_addition_requests_age_group_id_idx" ON "assessment_content_addition_requests"("age_group_id");
CREATE INDEX "assessment_content_addition_requests_development_field_id_idx" ON "assessment_content_addition_requests"("development_field_id");
CREATE INDEX "assessment_content_addition_requests_subject_id_idx" ON "assessment_content_addition_requests"("subject_id");
CREATE INDEX "assessment_content_addition_requests_theme_id_idx" ON "assessment_content_addition_requests"("theme_id");
CREATE INDEX "assessment_content_addition_requests_topic_id_idx" ON "assessment_content_addition_requests"("topic_id");
CREATE INDEX "assessment_content_addition_requests_criterion_id_idx" ON "assessment_content_addition_requests"("criterion_id");
CREATE INDEX "assessment_content_addition_requests_created_at_idx" ON "assessment_content_addition_requests"("created_at");

ALTER TABLE "assessment_content_addition_requests" ADD CONSTRAINT "assessment_content_addition_requests_age_group_id_fkey" FOREIGN KEY ("age_group_id") REFERENCES "assessment_age_groups"("assessment_age_group_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assessment_content_addition_requests" ADD CONSTRAINT "assessment_content_addition_requests_development_field_id_fkey" FOREIGN KEY ("development_field_id") REFERENCES "development_fields"("development_field_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assessment_content_addition_requests" ADD CONSTRAINT "assessment_content_addition_requests_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "assessment_subjects"("assessment_subject_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assessment_content_addition_requests" ADD CONSTRAINT "assessment_content_addition_requests_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "assessment_themes"("assessment_theme_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assessment_content_addition_requests" ADD CONSTRAINT "assessment_content_addition_requests_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "assessment_topics"("assessment_topic_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assessment_content_addition_requests" ADD CONSTRAINT "assessment_content_addition_requests_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "assessment_criteria"("assessment_criterion_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assessment_content_addition_requests" ADD CONSTRAINT "assessment_content_addition_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "accounts"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assessment_content_addition_requests" ADD CONSTRAINT "assessment_content_addition_requests_requester_teacher_id_fkey" FOREIGN KEY ("requester_teacher_id") REFERENCES "teachers"("teacher_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assessment_content_addition_requests" ADD CONSTRAINT "assessment_content_addition_requests_requester_class_id_fkey" FOREIGN KEY ("requester_class_id") REFERENCES "classes"("class_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assessment_content_addition_requests" ADD CONSTRAINT "assessment_content_addition_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "accounts"("account_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assessment_content_addition_requests" ADD CONSTRAINT "assessment_content_addition_requests_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "accounts"("account_id") ON DELETE SET NULL ON UPDATE CASCADE;
