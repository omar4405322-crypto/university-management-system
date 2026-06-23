-- Align database with application schema (Exam uses room; registration phone optional)
ALTER TABLE "RegistrationRequest" ADD COLUMN IF NOT EXISTS "phone" TEXT;
