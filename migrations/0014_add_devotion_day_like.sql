-- CreateTable
CREATE TABLE IF NOT EXISTS "DevotionDayLike" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DevotionDayLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DevotionDayLike_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "DevotionDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DevotionDayLike_userId_dayId_key" ON "DevotionDayLike"("userId", "dayId");
