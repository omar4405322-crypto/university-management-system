-- DropIndex
DROP INDEX "QuizSubmission_quizId_studentId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "QuizSubmission_quizId_studentId_key" ON "QuizSubmission"("quizId", "studentId");
