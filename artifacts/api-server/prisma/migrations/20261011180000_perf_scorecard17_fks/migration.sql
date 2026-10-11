-- CreateIndex
CREATE INDEX "AbsenceThresholdPolicy_courseId_idx" ON "AbsenceThresholdPolicy"("courseId");

-- CreateIndex
CREATE INDEX "AbsenceThresholdPolicy_departmentId_idx" ON "AbsenceThresholdPolicy"("departmentId");

-- CreateIndex
CREATE INDEX "AttendanceSession_doctorId_idx" ON "AttendanceSession"("doctorId");

-- CreateIndex
CREATE INDEX "Quiz_doctorId_idx" ON "Quiz"("doctorId");

-- CreateIndex
CREATE INDEX "RegistrationRequest_departmentId_idx" ON "RegistrationRequest"("departmentId");

-- CreateIndex
CREATE INDEX "ScheduleSlot_roomId_idx" ON "ScheduleSlot"("roomId");

-- CreateIndex
CREATE INDEX "Student_groupId_idx" ON "Student"("groupId");

-- CreateIndex
CREATE INDEX "User_collegeId_idx" ON "User"("collegeId");

-- CreateIndex
CREATE INDEX "User_departmentId_idx" ON "User"("departmentId");

-- CreateIndex
CREATE INDEX "User_managedCollegeId_idx" ON "User"("managedCollegeId");

-- CreateIndex
CREATE INDEX "User_managedDepartmentId_idx" ON "User"("managedDepartmentId");
