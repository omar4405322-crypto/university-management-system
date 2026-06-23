-- Required before running prisma db push.
-- Creates the PostgreSQL sequence used by the Doctor model for auto-generating doctorId values.
CREATE SEQUENCE IF NOT EXISTS doctor_id_seq;
