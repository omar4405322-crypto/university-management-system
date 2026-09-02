-- CreateIndex
CREATE INDEX "ScheduleChangeRequest_status_courseId_idx" ON "ScheduleChangeRequest"("status", "courseId");

-- CreateIndex
CREATE INDEX "ScheduleChangeRequest_requesterId_idx" ON "ScheduleChangeRequest"("requesterId");

-- CreateIndex
CREATE INDEX "ScheduleChangeRequest_scheduleSlotId_idx" ON "ScheduleChangeRequest"("scheduleSlotId");

-- CreateIndex
CREATE INDEX "ScheduleOverride_dayOfWeek_room_startDate_endDate_idx" ON "ScheduleOverride"("dayOfWeek", "room", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "ScheduleSlot_dayOfWeek_room_idx" ON "ScheduleSlot"("dayOfWeek", "room");

-- CreateIndex
CREATE INDEX "ScheduleSlot_dayOfWeek_doctorId_idx" ON "ScheduleSlot"("dayOfWeek", "doctorId");

-- CreateIndex
CREATE INDEX "ScheduleSlot_dayOfWeek_teachingAssistantId_idx" ON "ScheduleSlot"("dayOfWeek", "teachingAssistantId");

-- CreateIndex
CREATE INDEX "StudentGroup_departmentId_year_idx" ON "StudentGroup"("departmentId", "year");

-- CreateIndex
CREATE INDEX "StudentGroup_parentGroupId_idx" ON "StudentGroup"("parentGroupId");
