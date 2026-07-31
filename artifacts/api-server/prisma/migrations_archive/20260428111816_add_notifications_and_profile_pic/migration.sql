-- AlterTable
ALTER TABLE "Doctor" ADD COLUMN     "address" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "gender" TEXT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "gender" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "profilePicture" TEXT;

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
