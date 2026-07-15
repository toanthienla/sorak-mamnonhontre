CREATE TABLE "assessment_content_request_created_records" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "record_type" VARCHAR(30) NOT NULL,
    "record_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_content_request_created_records_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "assessment_content_addition_requests" ALTER COLUMN "proposed_name" TYPE VARCHAR(1000);

CREATE INDEX "assessment_content_request_created_records_request_id_idx" ON "assessment_content_request_created_records"("request_id");
CREATE INDEX "assessment_content_request_created_records_record_type_record_id_idx" ON "assessment_content_request_created_records"("record_type", "record_id");

ALTER TABLE "assessment_content_request_created_records" ADD CONSTRAINT "assessment_content_request_created_records_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "assessment_content_addition_requests"("request_id") ON DELETE CASCADE ON UPDATE CASCADE;
