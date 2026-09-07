-- CreateIndex
CREATE INDEX "Attendance_studentId_courseId_date_idx" ON "Attendance"("studentId", "courseId", "date");

-- CreateIndex
CREATE INDEX "Attendance_studentId_date_status_idx" ON "Attendance"("studentId", "date", "status");

-- CreateIndex
CREATE INDEX "Attendance_sessionId_ipAddress_deviceId_idx" ON "Attendance"("sessionId", "ipAddress", "deviceId");

-- CreateIndex
CREATE INDEX "Enrollment_courseId_status_idx" ON "Enrollment"("courseId", "status");
