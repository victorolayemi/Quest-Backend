CREATE TABLE "CommunityMessageReaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityMessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommunityMessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "CommunityMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CommunityMessageCommentLike" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityMessageCommentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommunityMessageCommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "CommunityMessageComment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CommunityMessageReaction_userId_messageId_emoji_key" ON "CommunityMessageReaction"("userId", "messageId", "emoji");
CREATE UNIQUE INDEX "CommunityMessageCommentLike_userId_commentId_key" ON "CommunityMessageCommentLike"("userId", "commentId");

ALTER TABLE "CommunityMessageComment" ADD COLUMN "likesCount" INTEGER NOT NULL DEFAULT 0;
