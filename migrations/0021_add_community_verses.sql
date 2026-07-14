-- Migration number: 0021 	 2026-07-14T07:23:20.826Z

-- CreateTable
CREATE TABLE "CommunityDailyVerse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "communityId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "explanation" TEXT,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "sharesCount" INTEGER NOT NULL DEFAULT 0,
    "commentsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityDailyVerse_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommunityDailyVerseLike" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "verseId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityDailyVerseLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommunityDailyVerseLike_verseId_fkey" FOREIGN KEY ("verseId") REFERENCES "CommunityDailyVerse" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CommunityDailyVerse_communityId_date_key" ON "CommunityDailyVerse"("communityId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityDailyVerseLike_userId_verseId_key" ON "CommunityDailyVerseLike"("userId", "verseId");
