-- BGH/GV login by phone + OTP (replaces username/password)
ALTER TABLE "accounts" ADD COLUMN "otp_code" VARCHAR(10);
ALTER TABLE "accounts" ADD COLUMN "otp_expires_at" TIMESTAMP(3);

-- phone must be unique (login identifier). NULLs allowed (multiple).
CREATE UNIQUE INDEX "accounts_phone_key" ON "accounts"("phone");
