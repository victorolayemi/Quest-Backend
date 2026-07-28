-- Add otpMethod and SMTP columns to GlobalSettings
ALTER TABLE "GlobalSettings" ADD COLUMN "otpMethod" TEXT NOT NULL DEFAULT 'twilio';
ALTER TABLE "GlobalSettings" ADD COLUMN "smtpHost" TEXT;
ALTER TABLE "GlobalSettings" ADD COLUMN "smtpPort" INTEGER;
ALTER TABLE "GlobalSettings" ADD COLUMN "smtpUser" TEXT;
ALTER TABLE "GlobalSettings" ADD COLUMN "smtpPass" TEXT;
ALTER TABLE "GlobalSettings" ADD COLUMN "smtpFrom" TEXT;
