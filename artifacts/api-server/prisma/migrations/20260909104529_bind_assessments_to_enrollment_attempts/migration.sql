-- Findings 4/5: bind assessments to offerings and submissions to enrollment attempts.
-- Add nullable first, backfill deterministically, then enforce NOT NULL.

ALTER TABLE "Exam" ADD COLUMN "academicYear" INTEGER, ADD COLUMN "semester" INTEGER;
ALTER TABLE "Quiz" ADD COLUMN "academicYear" INTEGER, ADD COLUMN "semester" INTEGER;
ALTER TABLE "Task" ADD COLUMN "academicYear" INTEGER, ADD COLUMN "semester" INTEGER;
ALTER TABLE "ExamSubmission" ADD COLUMN "enrollmentId" INTEGER;
ALTER TABLE "QuizSubmission" ADD COLUMN "enrollmentId" INTEGER;
ALTER TABLE "TaskSubmission" ADD COLUMN "enrollmentId" INTEGER;

CREATE TEMP VIEW assessment_offering_windows AS
WITH offering_starts AS (
  SELECT "courseId", "academicYear", "semester", MIN("enrolledAt") AS starts_at
  FROM "Enrollment"
  GROUP BY "courseId", "academicYear", "semester"
)
SELECT o.*,
  (SELECT MIN(n.starts_at) FROM offering_starts n
    WHERE n."courseId" = o."courseId" AND n.starts_at > o.starts_at) AS ends_at,
  COUNT(*) OVER (PARTITION BY o."courseId", o.starts_at) AS same_start_count,
  COUNT(*) OVER (PARTITION BY o."courseId") AS offering_count
FROM offering_starts o;

-- Rule A1: the course has exactly one distinct offering.
UPDATE "Exam" a SET "academicYear" = o."academicYear", "semester" = o."semester"
FROM assessment_offering_windows o
WHERE a."courseId" = o."courseId" AND o.offering_count = 1;
UPDATE "Quiz" a SET "academicYear" = o."academicYear", "semester" = o."semester"
FROM assessment_offering_windows o
WHERE a."courseId" = o."courseId" AND o.offering_count = 1;
UPDATE "Task" a SET "academicYear" = o."academicYear", "semester" = o."semester"
FROM assessment_offering_windows o
WHERE a."courseId" = o."courseId" AND o.offering_count = 1;

-- Rule A2: on multi-offering courses, match the assessment date to the observed
-- offering start and the next distinct offering start. Equal starts are excluded.
WITH matches AS (
  SELECT a.id, MIN(o."academicYear") AS "academicYear", MIN(o."semester") AS "semester"
  FROM "Exam" a JOIN assessment_offering_windows o ON o."courseId" = a."courseId"
    AND o.offering_count > 1 AND o.same_start_count = 1
    AND a.date >= o.starts_at AND (o.ends_at IS NULL OR a.date < o.ends_at)
  WHERE a."academicYear" IS NULL GROUP BY a.id HAVING COUNT(*) = 1
)
UPDATE "Exam" a SET "academicYear" = m."academicYear", "semester" = m."semester"
FROM matches m WHERE a.id = m.id;

WITH matches AS (
  SELECT a.id, MIN(o."academicYear") AS "academicYear", MIN(o."semester") AS "semester"
  FROM "Quiz" a JOIN assessment_offering_windows o ON o."courseId" = a."courseId"
    AND o.offering_count > 1 AND o.same_start_count = 1
    AND a."startTime" >= o.starts_at AND (o.ends_at IS NULL OR a."startTime" < o.ends_at)
  WHERE a."academicYear" IS NULL AND a."startTime" IS NOT NULL GROUP BY a.id HAVING COUNT(*) = 1
)
UPDATE "Quiz" a SET "academicYear" = m."academicYear", "semester" = m."semester"
FROM matches m WHERE a.id = m.id;

WITH matches AS (
  SELECT a.id, MIN(o."academicYear") AS "academicYear", MIN(o."semester") AS "semester"
  FROM "Task" a JOIN assessment_offering_windows o ON o."courseId" = a."courseId"
    AND o.offering_count > 1 AND o.same_start_count = 1
    AND a."dueDate" >= o.starts_at AND (o.ends_at IS NULL OR a."dueDate" < o.ends_at)
  WHERE a."academicYear" IS NULL GROUP BY a.id HAVING COUNT(*) = 1
)
UPDATE "Task" a SET "academicYear" = m."academicYear", "semester" = m."semester"
FROM matches m WHERE a.id = m.id;

-- Rule B1: exactly one enrollment exists for the student/course pair.
WITH matches AS (
  SELECT s.id AS submission_id, MIN(e.id) AS enrollment_id
  FROM "ExamSubmission" s JOIN "Exam" a ON a.id = s."examId"
  JOIN "Enrollment" e ON e."studentId" = s."studentId" AND e."courseId" = a."courseId"
  GROUP BY s.id HAVING COUNT(*) = 1
)
UPDATE "ExamSubmission" s SET "enrollmentId" = m.enrollment_id FROM matches m WHERE s.id = m.submission_id;

WITH matches AS (
  SELECT s.id AS submission_id, MIN(e.id) AS enrollment_id
  FROM "QuizSubmission" s JOIN "Quiz" a ON a.id = s."quizId"
  JOIN "Enrollment" e ON e."studentId" = s."studentId" AND e."courseId" = a."courseId"
  GROUP BY s.id HAVING COUNT(*) = 1
)
UPDATE "QuizSubmission" s SET "enrollmentId" = m.enrollment_id FROM matches m WHERE s.id = m.submission_id;

WITH matches AS (
  SELECT s.id AS submission_id, MIN(e.id) AS enrollment_id
  FROM "TaskSubmission" s JOIN "Task" a ON a.id = s."taskId"
  JOIN "Enrollment" e ON e."studentId" = s."studentId" AND e."courseId" = a."courseId"
  GROUP BY s.id HAVING COUNT(*) = 1
)
UPDATE "TaskSubmission" s SET "enrollmentId" = m.enrollment_id FROM matches m WHERE s.id = m.submission_id;

CREATE TEMP VIEW enrollment_attempt_windows AS
SELECT e.*,
  (SELECT MIN(n."enrolledAt") FROM "Enrollment" n
    WHERE n."studentId" = e."studentId" AND n."courseId" = e."courseId"
      AND n."enrolledAt" > e."enrolledAt") AS ends_at,
  COUNT(*) OVER (PARTITION BY e."studentId", e."courseId", e."enrolledAt") AS same_start_count,
  COUNT(*) OVER (PARTITION BY e."studentId", e."courseId") AS attempt_count
FROM "Enrollment" e;

-- Rule B2: for retakes, match submittedAt/startedAt to enrolledAt and next enrolledAt.
-- Attempts with equal enrolledAt remain unresolved rather than being guessed.
WITH matches AS (
  SELECT s.id AS submission_id, MIN(e.id) AS enrollment_id
  FROM "ExamSubmission" s JOIN "Exam" a ON a.id = s."examId"
  JOIN enrollment_attempt_windows e ON e."studentId" = s."studentId" AND e."courseId" = a."courseId"
    AND e.attempt_count > 1 AND e.same_start_count = 1
    AND COALESCE(s."submittedAt", s."startedAt") >= e."enrolledAt"
    AND (e.ends_at IS NULL OR COALESCE(s."submittedAt", s."startedAt") < e.ends_at)
  WHERE s."enrollmentId" IS NULL GROUP BY s.id HAVING COUNT(*) = 1
)
UPDATE "ExamSubmission" s SET "enrollmentId" = m.enrollment_id FROM matches m WHERE s.id = m.submission_id;

WITH matches AS (
  SELECT s.id AS submission_id, MIN(e.id) AS enrollment_id
  FROM "QuizSubmission" s JOIN "Quiz" a ON a.id = s."quizId"
  JOIN enrollment_attempt_windows e ON e."studentId" = s."studentId" AND e."courseId" = a."courseId"
    AND e.attempt_count > 1 AND e.same_start_count = 1
    AND s."submittedAt" >= e."enrolledAt" AND (e.ends_at IS NULL OR s."submittedAt" < e.ends_at)
  WHERE s."enrollmentId" IS NULL GROUP BY s.id HAVING COUNT(*) = 1
)
UPDATE "QuizSubmission" s SET "enrollmentId" = m.enrollment_id FROM matches m WHERE s.id = m.submission_id;

WITH matches AS (
  SELECT s.id AS submission_id, MIN(e.id) AS enrollment_id
  FROM "TaskSubmission" s JOIN "Task" a ON a.id = s."taskId"
  JOIN enrollment_attempt_windows e ON e."studentId" = s."studentId" AND e."courseId" = a."courseId"
    AND e.attempt_count > 1 AND e.same_start_count = 1
    AND s."submittedAt" >= e."enrolledAt" AND (e.ends_at IS NULL OR s."submittedAt" < e.ends_at)
  WHERE s."enrollmentId" IS NULL GROUP BY s.id HAVING COUNT(*) = 1
)
UPDATE "TaskSubmission" s SET "enrollmentId" = m.enrollment_id FROM matches m WHERE s.id = m.submission_id;

-- Pre-migration inspection found zero unresolved rows across all six tables.
ALTER TABLE "Exam" ALTER COLUMN "academicYear" SET NOT NULL, ALTER COLUMN "semester" SET NOT NULL;
ALTER TABLE "Quiz" ALTER COLUMN "academicYear" SET NOT NULL, ALTER COLUMN "semester" SET NOT NULL;
ALTER TABLE "Task" ALTER COLUMN "academicYear" SET NOT NULL, ALTER COLUMN "semester" SET NOT NULL;
ALTER TABLE "ExamSubmission" ALTER COLUMN "enrollmentId" SET NOT NULL;
ALTER TABLE "QuizSubmission" ALTER COLUMN "enrollmentId" SET NOT NULL;
ALTER TABLE "TaskSubmission" ALTER COLUMN "enrollmentId" SET NOT NULL;

CREATE INDEX "Exam_courseId_academicYear_semester_idx" ON "Exam"("courseId", "academicYear", "semester");
CREATE INDEX "Quiz_courseId_academicYear_semester_idx" ON "Quiz"("courseId", "academicYear", "semester");
CREATE INDEX "Task_courseId_academicYear_semester_idx" ON "Task"("courseId", "academicYear", "semester");
CREATE INDEX "ExamSubmission_enrollmentId_idx" ON "ExamSubmission"("enrollmentId");
CREATE INDEX "QuizSubmission_enrollmentId_idx" ON "QuizSubmission"("enrollmentId");
CREATE INDEX "TaskSubmission_enrollmentId_idx" ON "TaskSubmission"("enrollmentId");

ALTER TABLE "ExamSubmission" ADD CONSTRAINT "ExamSubmission_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuizSubmission" ADD CONSTRAINT "QuizSubmission_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaskSubmission" ADD CONSTRAINT "TaskSubmission_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
