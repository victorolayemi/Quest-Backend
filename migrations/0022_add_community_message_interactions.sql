ALTER TABLE "CommunityMessage" ADD COLUMN "likesCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CommunityMessage" ADD COLUMN "commentsCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CommunityMessage" ADD COLUMN "sharesCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CommunityMessage" ADD COLUMN "bookmarksCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "CommunityMessageLike" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityMessageLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommunityMessageLike_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "CommunityMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CommunityMessageBookmark" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityMessageBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommunityMessageBookmark_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "CommunityMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CommunityMessageComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityMessageComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommunityMessageComment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "CommunityMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommunityMessageComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CommunityMessageComment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CommunityMessageLike_userId_messageId_key" ON "CommunityMessageLike"("userId", "messageId");
CREATE UNIQUE INDEX "CommunityMessageBookmark_userId_messageId_key" ON "CommunityMessageBookmark"("userId", "messageId");
