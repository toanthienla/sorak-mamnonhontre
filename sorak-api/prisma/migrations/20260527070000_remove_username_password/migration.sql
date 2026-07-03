-- Login is phone+OTP only. Drop username/password and password-reset columns.
DROP INDEX IF EXISTS "accounts_username_key";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "username";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "password_hash";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "reset_token";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "reset_token_expires_at";
