-- Merge student_classes + student_year_enrollments into student_enrollments
-- Goals:
--  - Single source of truth per (student, year)
--  - class_id nullable for "enrolled, no class yet"
--  - Unique using PG15 NULLS NOT DISTINCT

-- 1. Create new table
CREATE TABLE "student_enrollments" (
    "enrollment_id"  SERIAL PRIMARY KEY,
    "student_id"     INT NOT NULL,
    "school_year_id" INT NOT NULL,
    "class_id"       INT,
    "grade_level"    VARCHAR(30),
    "enrolled_date"  TIMESTAMP NOT NULL DEFAULT NOW(),
    "left_date"      TIMESTAMP,
    "student_status" VARCHAR(50) NOT NULL DEFAULT 'Đang học',
    CONSTRAINT "fk_se_student" FOREIGN KEY ("student_id") REFERENCES "students"("student_id"),
    CONSTRAINT "fk_se_year"    FOREIGN KEY ("school_year_id") REFERENCES "school_years"("school_year_id"),
    CONSTRAINT "fk_se_class"   FOREIGN KEY ("class_id") REFERENCES "classes"("class_id")
);

CREATE INDEX "idx_se_student_year" ON "student_enrollments"("student_id", "school_year_id");
CREATE INDEX "idx_se_class" ON "student_enrollments"("class_id");

-- Unique with NULLS NOT DISTINCT — duplicate (student, year, null class) prevented too
CREATE UNIQUE INDEX "uniq_se_student_year_class"
    ON "student_enrollments"("student_id", "school_year_id", "class_id") NULLS NOT DISTINCT;

-- 2. Backfill from student_classes (join class → year)
INSERT INTO "student_enrollments" (student_id, school_year_id, class_id, grade_level, enrolled_date, left_date, student_status)
SELECT sc.student_id,
       c.school_year_id,
       sc.class_id,
       c.age_group,
       sc.enrolled_date,
       sc.left_date,
       sc.student_status
FROM "student_classes" sc
JOIN "classes" c ON c.class_id = sc.class_id;

-- 3. Backfill from student_year_enrollments for rows NOT already covered (student had no class in that year)
INSERT INTO "student_enrollments" (student_id, school_year_id, class_id, grade_level, enrolled_date, student_status)
SELECT sye.student_id, sye.school_year_id, NULL, sye.grade_level, sye.enrolled_at, 'Đang học'
FROM "student_year_enrollments" sye
WHERE NOT EXISTS (
    SELECT 1 FROM "student_enrollments" se
    WHERE se.student_id = sye.student_id
      AND se.school_year_id = sye.school_year_id
);

-- 4. Drop old tables
DROP TABLE "student_classes";
DROP TABLE "student_year_enrollments";
