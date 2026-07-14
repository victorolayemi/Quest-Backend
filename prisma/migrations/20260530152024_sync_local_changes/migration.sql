/*
  Warnings:

  - You are about to drop the column `pushBooks` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `pushCommunities` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `pushDevotions` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `pushMessages` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `pushVideos` on the `User` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "location" TEXT,
    "appearance" TEXT NOT NULL DEFAULT 'system',
    "soundAlerts" BOOLEAN NOT NULL DEFAULT true,
    "hapticFeedback" BOOLEAN NOT NULL DEFAULT true,
    "music" BOOLEAN NOT NULL DEFAULT true,
    "allNotifications" BOOLEAN NOT NULL DEFAULT true,
    "inAppNotifications" BOOLEAN NOT NULL DEFAULT true,
    "doNotDisturb" BOOLEAN NOT NULL DEFAULT false,
    "reminderMorning" BOOLEAN NOT NULL DEFAULT false,
    "reminderAfternoon" BOOLEAN NOT NULL DEFAULT false,
    "reminderEvening" BOOLEAN NOT NULL DEFAULT false,
    "reminderCustomTime" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("appearance", "avatarUrl", "bio", "createdAt", "email", "firstName", "gender", "id", "isGuest", "lastName", "location", "password", "phoneNumber", "points", "streakCount", "updatedAt", "username") SELECT "appearance", "avatarUrl", "bio", "createdAt", "email", "firstName", "gender", "id", "isGuest", "lastName", "location", "password", "phoneNumber", "points", "streakCount", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
