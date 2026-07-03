-- CreateTable
CREATE TABLE "roles" (
    "role_id" SERIAL NOT NULL,
    "role_name" VARCHAR(20) NOT NULL,
    "description" VARCHAR(255),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("role_id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "account_id" SERIAL NOT NULL,
    "role_id" INTEGER NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(20),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "reset_token" VARCHAR(255),
    "reset_token_expires_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "teacher_profiles" (
    "teacher_profile_id" SERIAL NOT NULL,
    "account_id" INTEGER NOT NULL,
    "teacher_code" VARCHAR(20) NOT NULL,
    "cccd" VARCHAR(20),
    "date_of_birth" TIMESTAMP(3),
    "gender" VARCHAR(10),
    "address" VARCHAR(500),
    "work_start_date" TIMESTAMP(3),
    "qualification" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_profiles_pkey" PRIMARY KEY ("teacher_profile_id")
);

-- CreateTable
CREATE TABLE "school_years" (
    "school_year_id" SERIAL NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'upcoming',
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "school_years_pkey" PRIMARY KEY ("school_year_id")
);

-- CreateTable
CREATE TABLE "semesters" (
    "semester_id" SERIAL NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "semester_number" INTEGER NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "semesters_pkey" PRIMARY KEY ("semester_id")
);

-- CreateTable
CREATE TABLE "classes" (
    "class_id" SERIAL NOT NULL,
    "class_name" VARCHAR(100) NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "age_group" VARCHAR(30),
    "room" VARCHAR(50),
    "max_capacity" INTEGER NOT NULL DEFAULT 30,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "classes_pkey" PRIMARY KEY ("class_id")
);

-- CreateTable
CREATE TABLE "teacher_classes" (
    "teacher_class_id" SERIAL NOT NULL,
    "teacher_profile_id" INTEGER NOT NULL,
    "class_id" INTEGER NOT NULL,
    "is_homeroom" BOOLEAN NOT NULL DEFAULT false,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at" TIMESTAMP(3),

    CONSTRAINT "teacher_classes_pkey" PRIMARY KEY ("teacher_class_id")
);

-- CreateTable
CREATE TABLE "students" (
    "student_id" SERIAL NOT NULL,
    "moet_id" VARCHAR(20),
    "national_id" VARCHAR(20),
    "identity_verified" BOOLEAN NOT NULL DEFAULT false,
    "student_id_card_number" VARCHAR(20) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "date_of_birth" TIMESTAMP(3) NOT NULL,
    "gender" VARCHAR(10) NOT NULL,
    "grade_level" VARCHAR(30),
    "student_status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "enrollment_type" VARCHAR(20) NOT NULL DEFAULT 'full_day',
    "enrollment_date" TIMESTAMP(3),
    "new_admission_date" TIMESTAMP(3),
    "is_new_admission" BOOLEAN NOT NULL DEFAULT false,
    "order_number" INTEGER,
    "ethnicity" VARCHAR(50),
    "nationality" VARCHAR(50),
    "religion" VARCHAR(50),
    "area_type" VARCHAR(20),
    "blood_type" VARCHAR(5),
    "contact_phone" VARCHAR(20),
    "permanent_province" VARCHAR(100),
    "permanent_ward" VARCHAR(100),
    "permanent_address_detail" VARCHAR(500),
    "current_address" VARCHAR(500),
    "hometown_province" VARCHAR(100),
    "hometown_ward" VARCHAR(100),
    "birth_place" VARCHAR(255),
    "photo_url" VARCHAR(500),
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "students_pkey" PRIMARY KEY ("student_id")
);

-- CreateTable
CREATE TABLE "parents" (
    "parent_id" SERIAL NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "relationship" VARCHAR(50),
    "birth_year" INTEGER,
    "is_ethnic_minority" BOOLEAN NOT NULL DEFAULT false,
    "job" VARCHAR(150),
    "workplace" VARCHAR(255),
    "phone" VARCHAR(20),
    "email" VARCHAR(150),
    "id_number" VARCHAR(20),
    "address" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parents_pkey" PRIMARY KEY ("parent_id")
);

-- CreateTable
CREATE TABLE "student_parents" (
    "student_id" INTEGER NOT NULL,
    "parent_id" INTEGER NOT NULL,
    "is_primary_contact" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "student_parents_pkey" PRIMARY KEY ("student_id","parent_id")
);

-- CreateTable
CREATE TABLE "student_classes" (
    "student_class_id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "class_id" INTEGER NOT NULL,
    "enrolled_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_date" TIMESTAMP(3),

    CONSTRAINT "student_classes_pkey" PRIMARY KEY ("student_class_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_role_name_key" ON "roles"("role_name");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_username_key" ON "accounts"("username");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts"("email");

-- CreateIndex
CREATE INDEX "accounts_role_id_idx" ON "accounts"("role_id");

-- CreateIndex
CREATE INDEX "accounts_deleted_at_idx" ON "accounts"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_profiles_account_id_key" ON "teacher_profiles"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_profiles_teacher_code_key" ON "teacher_profiles"("teacher_code");

-- CreateIndex
CREATE UNIQUE INDEX "school_years_name_key" ON "school_years"("name");

-- CreateIndex
CREATE UNIQUE INDEX "semesters_school_year_id_semester_number_key" ON "semesters"("school_year_id", "semester_number");

-- CreateIndex
CREATE INDEX "classes_school_year_id_idx" ON "classes"("school_year_id");

-- CreateIndex
CREATE INDEX "classes_deleted_at_idx" ON "classes"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_classes_teacher_profile_id_class_id_key" ON "teacher_classes"("teacher_profile_id", "class_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_moet_id_key" ON "students"("moet_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_student_id_card_number_key" ON "students"("student_id_card_number");

-- CreateIndex
CREATE INDEX "students_deleted_at_idx" ON "students"("deleted_at");

-- CreateIndex
CREATE INDEX "students_full_name_idx" ON "students"("full_name");

-- CreateIndex
CREATE INDEX "parents_phone_idx" ON "parents"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "student_classes_student_id_class_id_key" ON "student_classes"("student_id", "class_id");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semesters" ADD CONSTRAINT "semesters_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("school_year_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("school_year_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_classes" ADD CONSTRAINT "teacher_classes_teacher_profile_id_fkey" FOREIGN KEY ("teacher_profile_id") REFERENCES "teacher_profiles"("teacher_profile_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_classes" ADD CONSTRAINT "teacher_classes_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("class_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "accounts"("account_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "accounts"("account_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_parents" ADD CONSTRAINT "student_parents_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("student_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_parents" ADD CONSTRAINT "student_parents_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "parents"("parent_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_classes" ADD CONSTRAINT "student_classes_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("student_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_classes" ADD CONSTRAINT "student_classes_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("class_id") ON DELETE RESTRICT ON UPDATE CASCADE;
