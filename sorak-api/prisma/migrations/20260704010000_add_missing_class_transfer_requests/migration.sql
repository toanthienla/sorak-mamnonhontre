CREATE TABLE IF NOT EXISTS "class_transfer_requests" (
    "request_id" SERIAL PRIMARY KEY,
    "student_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "semester_id" INTEGER,
    "from_class_id" INTEGER NOT NULL,
    "to_class_id" INTEGER NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "effective_date" TIMESTAMP(3) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Pending',
    "requested_by" INTEGER NOT NULL,
    "reviewed_by" INTEGER,
    "review_note" VARCHAR(500),
    "reviewed_at" TIMESTAMP(3),
    "applied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "class_transfer_requests_student_id_idx"
    ON "class_transfer_requests"("student_id");
CREATE INDEX IF NOT EXISTS "class_transfer_requests_school_year_id_idx"
    ON "class_transfer_requests"("school_year_id");
CREATE INDEX IF NOT EXISTS "class_transfer_requests_status_idx"
    ON "class_transfer_requests"("status");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'class_transfer_requests_student_id_fkey'
    ) THEN
        ALTER TABLE "class_transfer_requests"
        ADD CONSTRAINT "class_transfer_requests_student_id_fkey"
        FOREIGN KEY ("student_id") REFERENCES "students"("student_id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'class_transfer_requests_school_year_id_fkey'
    ) THEN
        ALTER TABLE "class_transfer_requests"
        ADD CONSTRAINT "class_transfer_requests_school_year_id_fkey"
        FOREIGN KEY ("school_year_id") REFERENCES "school_years"("school_year_id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'class_transfer_requests_semester_id_fkey'
    ) THEN
        ALTER TABLE "class_transfer_requests"
        ADD CONSTRAINT "class_transfer_requests_semester_id_fkey"
        FOREIGN KEY ("semester_id") REFERENCES "semesters"("semester_id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'class_transfer_requests_from_class_id_fkey'
    ) THEN
        ALTER TABLE "class_transfer_requests"
        ADD CONSTRAINT "class_transfer_requests_from_class_id_fkey"
        FOREIGN KEY ("from_class_id") REFERENCES "classes"("class_id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'class_transfer_requests_to_class_id_fkey'
    ) THEN
        ALTER TABLE "class_transfer_requests"
        ADD CONSTRAINT "class_transfer_requests_to_class_id_fkey"
        FOREIGN KEY ("to_class_id") REFERENCES "classes"("class_id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'class_transfer_requests_requested_by_fkey'
    ) THEN
        ALTER TABLE "class_transfer_requests"
        ADD CONSTRAINT "class_transfer_requests_requested_by_fkey"
        FOREIGN KEY ("requested_by") REFERENCES "accounts"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'class_transfer_requests_reviewed_by_fkey'
    ) THEN
        ALTER TABLE "class_transfer_requests"
        ADD CONSTRAINT "class_transfer_requests_reviewed_by_fkey"
        FOREIGN KEY ("reviewed_by") REFERENCES "accounts"("account_id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
