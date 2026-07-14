/*
  Warnings:

  - You are about to drop the column `difficulty` on the `BibleQuizQuestion` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BibleQuizQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionText" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "correctAnswerIndex" INTEGER NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BibleQuizQuestion" ("correctAnswerIndex", "createdAt", "id", "options", "questionText", "updatedAt") SELECT "correctAnswerIndex", "createdAt", "id", "options", "questionText", "updatedAt" FROM "BibleQuizQuestion";
DROP TABLE "BibleQuizQuestion";
ALTER TABLE "new_BibleQuizQuestion" RENAME TO "BibleQuizQuestion";
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
    "doNotDisturb" BOOLEAN NOT NULL DEFAULT false,
    "reminderMorning" BOOLEAN NOT NULL DEFAULT false,
    "reminderAfternoon" BOOLEAN NOT NULL DEFAULT false,
    "reminderEvening" BOOLEAN NOT NULL DEFAULT false,
    "reminderCustomTime" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "fcmToken" TEXT,
    "bibleQuizLevel" INTEGER NOT NULL DEFAULT 1
);
INSERT INTO "new_User" ("allNotifications", "appearance", "avatarUrl", "bio", "createdAt", "doNotDisturb", "email", "fcmToken", "firstName", "gender", "hapticFeedback", "id", "inAppNotifications", "isAdmin", "isBanned", "isGuest", "lastName", "location", "music", "password", "phoneNumber", "points", "reminderAfternoon", "reminderCustomTime", "reminderEvening", "reminderMorning", "soundAlerts", "streakCount", "updatedAt", "username") SELECT "allNotifications", "appearance", "avatarUrl", "bio", "createdAt", "doNotDisturb", "email", "fcmToken", "firstName", "gender", "hapticFeedback", "id", "inAppNotifications", "isAdmin", "isBanned", "isGuest", "lastName", "location", "music", "password", "phoneNumber", "points", "reminderAfternoon", "reminderCustomTime", "reminderEvening", "reminderMorning", "soundAlerts", "streakCount", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
