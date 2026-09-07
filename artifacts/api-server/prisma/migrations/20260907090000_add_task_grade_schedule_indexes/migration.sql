-- B14: student-leading transcript lookups
CREATE INDEX "QuizSubmission_studentId_quizId_idx"
ON "QuizSubmission"("studentId", "quizId");

CREATE INDEX "TaskSubmission_studentId_taskId_idx"
ON "TaskSubmission"("studentId", "taskId");

CREATE INDEX "ExamSubmission_studentId_examId_idx"
ON "ExamSubmission"("studentId", "examId");

-- B14: task lists scoped by doctor/course and ordered or filtered by date
CREATE INDEX "Task_doctorId_isDeleted_createdAt_idx"
ON "Task"("doctorId", "isDeleted", "createdAt");

CREATE INDEX "Task_doctorId_isDeleted_dueDate_idx"
ON "Task"("doctorId", "isDeleted", "dueDate");

CREATE INDEX "Task_courseId_isDeleted_createdAt_idx"
ON "Task"("courseId", "isDeleted", "createdAt");

CREATE INDEX "Task_courseId_isDeleted_dueDate_idx"
ON "Task"("courseId", "isDeleted", "dueDate");

-- B15: active schedule-override conflicts by instructor and day
CREATE INDEX "ScheduleOverride_day_doctor_active_dates_idx"
ON "ScheduleOverride"("dayOfWeek", "doctorId", "startDate", "endDate");

CREATE INDEX "ScheduleOverride_day_ta_active_dates_idx"
ON "ScheduleOverride"("dayOfWeek", "teachingAssistantId", "startDate", "endDate");
