-- CreateTable
CREATE TABLE "Course" (
    "id" SERIAL NOT NULL,
    "courseCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "credits" INTEGER NOT NULL DEFAULT 3,
    "maxStudents" INTEGER NOT NULL DEFAULT 30,
    "doctorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Course_courseCode_key" ON "Course"("courseCode");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
