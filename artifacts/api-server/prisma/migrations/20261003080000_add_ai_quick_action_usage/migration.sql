-- CreateTable
CREATE TABLE "AIQuickActionUsage" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "actionKey" TEXT NOT NULL,
    "usageDate" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIQuickActionUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AIQuickActionUsage_userId_actionKey_usageDate_key" ON "AIQuickActionUsage"("userId", "actionKey", "usageDate");

-- CreateIndex
CREATE INDEX "AIQuickActionUsage_userId_usageDate_idx" ON "AIQuickActionUsage"("userId", "usageDate");

-- CreateIndex
CREATE INDEX "AIQuickActionUsage_userId_lastUsedAt_idx" ON "AIQuickActionUsage"("userId", "lastUsedAt");

-- AddForeignKey
ALTER TABLE "AIQuickActionUsage" ADD CONSTRAINT "AIQuickActionUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
