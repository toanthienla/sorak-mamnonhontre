-- Migrate student_status to Vietnamese values
UPDATE "students" SET "student_status" = 'đang học' WHERE "student_status" = 'active';
UPDATE "students" SET "student_status" = 'thôi học'  WHERE "student_status" = 'inactive';
