-- AlterTable
ALTER TABLE "PersonalNote" ADD COLUMN "verses" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppFeature" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AppFeature" ("createdAt", "id", "isEnabled", "key", "updatedAt") SELECT "createdAt", "id", "isEnabled", "key", "updatedAt" FROM "AppFeature";
DROP TABLE "AppFeature";
ALTER TABLE "new_AppFeature" RENAME TO "AppFeature";
CREATE UNIQUE INDEX "AppFeature_key_key" ON "AppFeature"("key");
CREATE TABLE "new_Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SYSTEM',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Notification" ("createdAt", "id", "isRead", "message", "title", "userId") SELECT "createdAt", "id", "isRead", "message", "title", "userId" FROM "Notification";
DROP TABLE "Notification";
ALTER TABLE "new_Notification" RENAME TO "Notification";
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
    "fcmToken" TEXT
);
INSERT INTO "new_User" ("allNotifications", "appearance", "avatarUrl", "bio", "createdAt", "doNotDisturb", "email", "fcmToken", "firstName", "gender", "hapticFeedback", "id", "inAppNotifications", "isAdmin", "isBanned", "isGuest", "lastName", "location", "music", "password", "phoneNumber", "points", "reminderAfternoon", "reminderCustomTime", "reminderEvening", "reminderMorning", "soundAlerts", "streakCount", "updatedAt", "username") SELECT "allNotifications", "appearance", "avatarUrl", "bio", "createdAt", "doNotDisturb", "email", "fcmToken", "firstName", "gender", "hapticFeedback", "id", "inAppNotifications", "isAdmin", "isBanned", "isGuest", "lastName", "location", "music", "password", "phoneNumber", "points", "reminderAfternoon", "reminderCustomTime", "reminderEvening", "reminderMorning", "soundAlerts", "streakCount", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

