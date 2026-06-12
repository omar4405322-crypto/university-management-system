-- Migration: add managedCollegeId to User
ALTER TABLE "User" ADD COLUMN "managedCollegeId" INTEGER;
ALTER TABLE "User" ADD CONSTRAINT "User_managedCollegeId_fkey" FOREIGN KEY ("managedCollegeId") REFERENCES "College"(id) ON DELETE SET NULL;

-- It's recommended to run `npx prisma migrate dev` to create a proper migration in your environment and generate the client.
