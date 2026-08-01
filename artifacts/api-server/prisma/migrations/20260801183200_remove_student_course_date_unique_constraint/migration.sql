-- DropIndex
DROP INDEX IF EXISTS "Attendance_studentId_courseId_date_key";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Attendance_studentId_sessionId_key" ON "Attendance"("studentId", "sessionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Attendance_method_idx" ON "Attendance"("method");
