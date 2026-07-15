-- AlterTable
ALTER TABLE "CommunityMessage" ADD COLUMN "title" TEXT;

-- Removed DropTable _cf_METADATA

-- CreateTable
CREATE TABLE "MediaLike" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MediaLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MediaLike_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "SermonMedia" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatClear" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clearedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatClear_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "DirectChat" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatClear_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "originalTxId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "isAutoRenewing" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Subscription" ("createdAt", "expiresAt", "id", "originalTxId", "platform", "productId", "status", "updatedAt", "userId") SELECT "createdAt", "expiresAt", "id", "originalTxId", "platform", "productId", "status", "updatedAt", "userId" FROM "Subscription";
DROP TABLE "Subscription";
ALTER TABLE "new_Subscription" RENAME TO "Subscription";
CREATE UNIQUE INDEX "Subscription_originalTxId_key" ON "Subscription"("originalTxId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "phoneNumber" TEXT,
    "password" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "username" TEXT,
    "gender" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "streakCount" INTEGER NOT NULL DEFAULT 0,
    "isGuest" BOOLEAN NOT NULL DEFAULT false,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "appearance" TEXT NOT NULL DEFAULT 'system',
    "soundAlerts" BOOLEAN NOT NULL DEFAULT true,
    "hapticFeedback" BOOLEAN NOT NULL DEFAULT true,
    "music" BOOLEAN NOT NULL DEFAULT true,
    "allNotifications" BOOLEAN NOT NULL DEFAULT true,
    "inAppNotifications" BOOLEAN NOT NULL DEFAULT true,
    "pushDirectMessages" BOOLEAN NOT NULL DEFAULT true,
    "pushCommunityPosts" BOOLEAN NOT NULL DEFAULT true,
    "pushCommunityForum" BOOLEAN NOT NULL DEFAULT true,
    "pushConnectionRequests" BOOLEAN NOT NULL DEFAULT true,
    "pushConnectionAccepted" BOOLEAN NOT NULL DEFAULT true,
    "doNotDisturb" BOOLEAN NOT NULL DEFAULT false,
    "autoScroll" BOOLEAN NOT NULL DEFAULT false,
    "reminderMorning" BOOLEAN NOT NULL DEFAULT false,
    "reminderAfternoon" BOOLEAN NOT NULL DEFAULT false,
    "reminderEvening" BOOLEAN NOT NULL DEFAULT false,
    "reminderCustomTime" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "fcmToken" TEXT,
    "bibleQuizLevel" INTEGER NOT NULL DEFAULT 1
);
INSERT INTO "new_User" ("allNotifications", "appearance", "autoScroll", "avatarUrl", "bibleQuizLevel", "bio", "createdAt", "doNotDisturb", "email", "fcmToken", "firstName", "gender", "hapticFeedback", "id", "inAppNotifications", "isAdmin", "isBanned", "isGuest", "lastName", "location", "music", "password", "phoneNumber", "points", "reminderAfternoon", "reminderCustomTime", "reminderEvening", "reminderMorning", "soundAlerts", "streakCount", "updatedAt", "username") SELECT "allNotifications", "appearance", "autoScroll", "avatarUrl", "bibleQuizLevel", "bio", "createdAt", "doNotDisturb", "email", "fcmToken", "firstName", "gender", "hapticFeedback", "id", "inAppNotifications", "isAdmin", "isBanned", "isGuest", "lastName", "location", "music", "password", "phoneNumber", "points", "reminderAfternoon", "reminderCustomTime", "reminderEvening", "reminderMorning", "soundAlerts", "streakCount", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE TABLE "new_UserMedia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserMedia_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserMedia" ("createdAt", "id", "type", "userId", "title", "mediaUrl", "updatedAt") SELECT "createdAt", "id", "type", "userId", '', '', CURRENT_TIMESTAMP FROM "UserMedia";
DROP TABLE "UserMedia";
ALTER TABLE "new_UserMedia" RENAME TO "UserMedia";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "MediaLike_userId_mediaId_key" ON "MediaLike"("userId", "mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatClear_chatId_userId_key" ON "ChatClear"("chatId", "userId");

