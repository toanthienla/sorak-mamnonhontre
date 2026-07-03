-- Remove MoET integration fields (not linking to Bộ GD&ĐT in scope)
ALTER TABLE "students" DROP COLUMN "moet_id";
ALTER TABLE "students" DROP COLUMN "identity_verified";

-- Remove CCCD from teacher_profiles (not required for internal system)
ALTER TABLE "teacher_profiles" DROP COLUMN "cccd";
