-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Task" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Task_isDeleted_idx" ON "Task"("isDeleted");
