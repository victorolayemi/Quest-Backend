CREATE TABLE `PostLike` (
	`id` text PRIMARY KEY NOT NULL,
	`postId` text NOT NULL,
	`userId` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `PostLike_postId_userId_key` ON `PostLike` (`postId`,`userId`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_OtpRequest` (
	`id` text PRIMARY KEY NOT NULL,
	`contact` text NOT NULL,
	`code` text NOT NULL,
	`expiresAt` numeric NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`userId` text,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_OtpRequest`("id", "contact", "code", "expiresAt", "verified", "userId") SELECT "id", "contact", "code", "expiresAt", "verified", "userId" FROM `OtpRequest`;--> statement-breakpoint
DROP TABLE `OtpRequest`;--> statement-breakpoint
ALTER TABLE `__new_OtpRequest` RENAME TO `OtpRequest`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_DirectMessage` (
	`id` text PRIMARY KEY NOT NULL,
	`chatId` text NOT NULL,
	`senderId` text NOT NULL,
	`text` text NOT NULL,
	`image` text,
	`isRead` integer DEFAULT false NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`chatId`) REFERENCES `DirectChat`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_DirectMessage`("id", "chatId", "senderId", "text", "image", "isRead", "createdAt") SELECT "id", "chatId", "senderId", "text", "image", "isRead", "createdAt" FROM `DirectMessage`;--> statement-breakpoint
DROP TABLE `DirectMessage`;--> statement-breakpoint
ALTER TABLE `__new_DirectMessage` RENAME TO `DirectMessage`;--> statement-breakpoint
CREATE TABLE `__new_PersonalNote` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`title` text NOT NULL,
	`bodyText` text NOT NULL,
	`isFavorite` integer DEFAULT false NOT NULL,
	`images` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`verses` text,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_PersonalNote`("id", "userId", "title", "bodyText", "isFavorite", "images", "createdAt", "verses") SELECT "id", "userId", "title", "bodyText", "isFavorite", "images", "createdAt", "verses" FROM `PersonalNote`;--> statement-breakpoint
DROP TABLE `PersonalNote`;--> statement-breakpoint
ALTER TABLE `__new_PersonalNote` RENAME TO `PersonalNote`;--> statement-breakpoint
CREATE TABLE `__new_UserPlanProgress` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`planId` text NOT NULL,
	`currentDay` integer DEFAULT 1 NOT NULL,
	`reminderTime` text DEFAULT '09:41 AM' NOT NULL,
	`reminderEnabled` integer DEFAULT true NOT NULL,
	`startedAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`completedAt` numeric,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_UserPlanProgress`("id", "userId", "planId", "currentDay", "reminderTime", "reminderEnabled", "startedAt", "completedAt") SELECT "id", "userId", "planId", "currentDay", "reminderTime", "reminderEnabled", "startedAt", "completedAt" FROM `UserPlanProgress`;--> statement-breakpoint
DROP TABLE `UserPlanProgress`;--> statement-breakpoint
ALTER TABLE `__new_UserPlanProgress` RENAME TO `UserPlanProgress`;--> statement-breakpoint
CREATE TABLE `__new_PlayProgress` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`mediaId` text NOT NULL,
	`progressSeconds` integer DEFAULT 0 NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`updatedAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`mediaId`) REFERENCES `SermonMedia`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_PlayProgress`("id", "userId", "mediaId", "progressSeconds", "completed", "updatedAt") SELECT "id", "userId", "mediaId", "progressSeconds", "completed", "updatedAt" FROM `PlayProgress`;--> statement-breakpoint
DROP TABLE `PlayProgress`;--> statement-breakpoint
ALTER TABLE `__new_PlayProgress` RENAME TO `PlayProgress`;--> statement-breakpoint
CREATE TABLE `__new_DailyBreadAttempt` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`dailyBreadId` text NOT NULL,
	`solved` integer DEFAULT false NOT NULL,
	`streakAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`dailyBreadId`) REFERENCES `DailyBread`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_DailyBreadAttempt`("id", "userId", "dailyBreadId", "solved", "streakAt", "createdAt") SELECT "id", "userId", "dailyBreadId", "solved", "streakAt", "createdAt" FROM `DailyBreadAttempt`;--> statement-breakpoint
DROP TABLE `DailyBreadAttempt`;--> statement-breakpoint
ALTER TABLE `__new_DailyBreadAttempt` RENAME TO `DailyBreadAttempt`;--> statement-breakpoint
CREATE TABLE `__new_ChallengeParticipant` (
	`id` text PRIMARY KEY NOT NULL,
	`challengeId` text NOT NULL,
	`userId` text NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`challengeId`) REFERENCES `Challenge`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_ChallengeParticipant`("id", "challengeId", "userId", "score", "completed") SELECT "id", "challengeId", "userId", "score", "completed" FROM `ChallengeParticipant`;--> statement-breakpoint
DROP TABLE `ChallengeParticipant`;--> statement-breakpoint
ALTER TABLE `__new_ChallengeParticipant` RENAME TO `ChallengeParticipant`;--> statement-breakpoint
CREATE TABLE `__new_Notification` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`type` text DEFAULT 'SYSTEM' NOT NULL,
	`isRead` integer DEFAULT false NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_Notification`("id", "userId", "title", "message", "type", "isRead", "createdAt") SELECT "id", "userId", "title", "message", "type", "isRead", "createdAt" FROM `Notification`;--> statement-breakpoint
DROP TABLE `Notification`;--> statement-breakpoint
ALTER TABLE `__new_Notification` RENAME TO `Notification`;--> statement-breakpoint
CREATE TABLE `__new_AppFeature` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`isEnabled` integer DEFAULT true NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updatedAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`value` text
);
--> statement-breakpoint
INSERT INTO `__new_AppFeature`("id", "key", "isEnabled", "createdAt", "updatedAt", "value") SELECT "id", "key", "isEnabled", "createdAt", "updatedAt", "value" FROM `AppFeature`;--> statement-breakpoint
DROP TABLE `AppFeature`;--> statement-breakpoint
ALTER TABLE `__new_AppFeature` RENAME TO `AppFeature`;--> statement-breakpoint
CREATE UNIQUE INDEX `AppFeature_key_key` ON `AppFeature` (`key`);--> statement-breakpoint
CREATE TABLE `__new_WordMatchQuestion` (
	`id` text PRIMARY KEY NOT NULL,
	`word` text NOT NULL,
	`match` text NOT NULL,
	`difficulty` text DEFAULT 'easy' NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updatedAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_WordMatchQuestion`("id", "word", "match", "difficulty", "createdAt", "updatedAt") SELECT "id", "word", "match", "difficulty", "createdAt", "updatedAt" FROM `WordMatchQuestion`;--> statement-breakpoint
DROP TABLE `WordMatchQuestion`;--> statement-breakpoint
ALTER TABLE `__new_WordMatchQuestion` RENAME TO `WordMatchQuestion`;--> statement-breakpoint
CREATE TABLE `__new_WordCrossQuestion` (
	`id` text PRIMARY KEY NOT NULL,
	`word` text NOT NULL,
	`clue` text NOT NULL,
	`difficulty` text DEFAULT 'easy' NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updatedAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_WordCrossQuestion`("id", "word", "clue", "difficulty", "createdAt", "updatedAt") SELECT "id", "word", "clue", "difficulty", "createdAt", "updatedAt" FROM `WordCrossQuestion`;--> statement-breakpoint
DROP TABLE `WordCrossQuestion`;--> statement-breakpoint
ALTER TABLE `__new_WordCrossQuestion` RENAME TO `WordCrossQuestion`;--> statement-breakpoint
CREATE TABLE `__new_GameSettings` (
	`id` text PRIMARY KEY NOT NULL,
	`gameType` text NOT NULL,
	`totalQuestions` integer DEFAULT 10 NOT NULL,
	`durationSecs` integer DEFAULT 60 NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updatedAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_GameSettings`("id", "gameType", "totalQuestions", "durationSecs", "createdAt", "updatedAt") SELECT "id", "gameType", "totalQuestions", "durationSecs", "createdAt", "updatedAt" FROM `GameSettings`;--> statement-breakpoint
DROP TABLE `GameSettings`;--> statement-breakpoint
ALTER TABLE `__new_GameSettings` RENAME TO `GameSettings`;--> statement-breakpoint
CREATE UNIQUE INDEX `GameSettings_gameType_key` ON `GameSettings` (`gameType`);--> statement-breakpoint
CREATE TABLE `__new_BibleQuizQuestion` (
	`id` text PRIMARY KEY NOT NULL,
	`questionText` text NOT NULL,
	`options` text NOT NULL,
	`correctAnswerIndex` integer NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updatedAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_BibleQuizQuestion`("id", "questionText", "options", "correctAnswerIndex", "level", "createdAt", "updatedAt") SELECT "id", "questionText", "options", "correctAnswerIndex", "level", "createdAt", "updatedAt" FROM `BibleQuizQuestion`;--> statement-breakpoint
DROP TABLE `BibleQuizQuestion`;--> statement-breakpoint
ALTER TABLE `__new_BibleQuizQuestion` RENAME TO `BibleQuizQuestion`;--> statement-breakpoint
CREATE TABLE `__new_Subscription` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`platform` text NOT NULL,
	`status` text NOT NULL,
	`originalTxId` text NOT NULL,
	`productId` text NOT NULL,
	`expiresAt` numeric NOT NULL,
	`isAutoRenewing` integer DEFAULT true NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updatedAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_Subscription`("id", "userId", "platform", "status", "originalTxId", "productId", "expiresAt", "isAutoRenewing", "createdAt", "updatedAt") SELECT "id", "userId", "platform", "status", "originalTxId", "productId", "expiresAt", "isAutoRenewing", "createdAt", "updatedAt" FROM `Subscription`;--> statement-breakpoint
DROP TABLE `Subscription`;--> statement-breakpoint
ALTER TABLE `__new_Subscription` RENAME TO `Subscription`;--> statement-breakpoint
CREATE UNIQUE INDEX `Subscription_originalTxId_key` ON `Subscription` (`originalTxId`);--> statement-breakpoint
CREATE TABLE `__new_UserMedia` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`title` text NOT NULL,
	`mediaUrl` text NOT NULL,
	`type` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updatedAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`imageUrl` text,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_UserMedia`("id", "userId", "title", "mediaUrl", "type", "createdAt", "updatedAt", "imageUrl") SELECT "id", "userId", "title", "mediaUrl", "type", "createdAt", "updatedAt", "imageUrl" FROM `UserMedia`;--> statement-breakpoint
DROP TABLE `UserMedia`;--> statement-breakpoint
ALTER TABLE `__new_UserMedia` RENAME TO `UserMedia`;--> statement-breakpoint
CREATE TABLE `__new_Community` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`image` text,
	`guidelines` text,
	`isPrivate` integer DEFAULT false NOT NULL,
	`isForumDisabledGlobally` integer DEFAULT false NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`creatorId` text,
	FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_Community`("id", "name", "description", "image", "guidelines", "isPrivate", "isForumDisabledGlobally", "createdAt", "creatorId") SELECT "id", "name", "description", "image", "guidelines", "isPrivate", "isForumDisabledGlobally", "createdAt", "creatorId" FROM `Community`;--> statement-breakpoint
DROP TABLE `Community`;--> statement-breakpoint
ALTER TABLE `__new_Community` RENAME TO `Community`;--> statement-breakpoint
CREATE UNIQUE INDEX `Community_name_key` ON `Community` (`name`);--> statement-breakpoint
CREATE TABLE `__new_CommunityMember` (
	`id` text PRIMARY KEY NOT NULL,
	`communityId` text NOT NULL,
	`userId` text NOT NULL,
	`role` text DEFAULT 'MEMBER' NOT NULL,
	`isSuspended` integer DEFAULT false NOT NULL,
	`canPostForum` integer DEFAULT true NOT NULL,
	`joinedAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_CommunityMember`("id", "communityId", "userId", "role", "isSuspended", "canPostForum", "joinedAt") SELECT "id", "communityId", "userId", "role", "isSuspended", "canPostForum", "joinedAt" FROM `CommunityMember`;--> statement-breakpoint
DROP TABLE `CommunityMember`;--> statement-breakpoint
ALTER TABLE `__new_CommunityMember` RENAME TO `CommunityMember`;--> statement-breakpoint
CREATE TABLE `__new_Book` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`author` text NOT NULL,
	`description` text,
	`imageUrl` text,
	`downloadUrl` text,
	`topic` text,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updatedAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`status` text DEFAULT 'APPROVED' NOT NULL,
	`authorId` text,
	`originalId` text,
	FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_Book`("id", "title", "author", "description", "imageUrl", "downloadUrl", "topic", "createdAt", "updatedAt", "status", "authorId", "originalId") SELECT "id", "title", "author", "description", "imageUrl", "downloadUrl", "topic", "createdAt", "updatedAt", "status", "authorId", "originalId" FROM `Book`;--> statement-breakpoint
DROP TABLE `Book`;--> statement-breakpoint
ALTER TABLE `__new_Book` RENAME TO `Book`;--> statement-breakpoint
CREATE TABLE `__new_User` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`phoneNumber` text,
	`password` text,
	`firstName` text,
	`lastName` text,
	`username` text,
	`gender` text,
	`avatarUrl` text,
	`bio` text,
	`points` integer DEFAULT 0 NOT NULL,
	`devotionPoints` integer DEFAULT 0 NOT NULL,
	`dailyBreadPoints` integer DEFAULT 0 NOT NULL,
	`audioReelPoints` integer DEFAULT 0 NOT NULL,
	`videoReelPoints` integer DEFAULT 0 NOT NULL,
	`quizPoints` integer DEFAULT 0 NOT NULL,
	`streakCount` integer DEFAULT 0 NOT NULL,
	`isGuest` integer DEFAULT false NOT NULL,
	`isAdmin` integer DEFAULT false NOT NULL,
	`isBanned` integer DEFAULT false NOT NULL,
	`location` text,
	`appearance` text DEFAULT 'system' NOT NULL,
	`soundAlerts` integer DEFAULT true NOT NULL,
	`hapticFeedback` integer DEFAULT true NOT NULL,
	`music` integer DEFAULT true NOT NULL,
	`allNotifications` integer DEFAULT true NOT NULL,
	`inAppNotifications` integer DEFAULT true NOT NULL,
	`pushDirectMessages` integer DEFAULT true NOT NULL,
	`pushCommunityPosts` integer DEFAULT true NOT NULL,
	`pushCommunityForum` integer DEFAULT true NOT NULL,
	`pushConnectionRequests` integer DEFAULT true NOT NULL,
	`pushConnectionAccepted` integer DEFAULT true NOT NULL,
	`doNotDisturb` integer DEFAULT false NOT NULL,
	`autoScroll` integer DEFAULT false NOT NULL,
	`reminderMorning` integer DEFAULT false NOT NULL,
	`reminderAfternoon` integer DEFAULT false NOT NULL,
	`reminderEvening` integer DEFAULT false NOT NULL,
	`reminderCustomTime` text,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updatedAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`fcmToken` text,
	`bibleQuizLevel` integer DEFAULT 1 NOT NULL,
	`isCommunityRestricted` integer DEFAULT false NOT NULL,
	`mediaRestrictionExpiry` numeric,
	`verificationBadge` text DEFAULT 'NONE' NOT NULL,
	`coinBalance` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_User`("id", "email", "phoneNumber", "password", "firstName", "lastName", "username", "gender", "avatarUrl", "bio", "points", "devotionPoints", "dailyBreadPoints", "audioReelPoints", "videoReelPoints", "quizPoints", "streakCount", "isGuest", "isAdmin", "isBanned", "location", "appearance", "soundAlerts", "hapticFeedback", "music", "allNotifications", "inAppNotifications", "pushDirectMessages", "pushCommunityPosts", "pushCommunityForum", "pushConnectionRequests", "pushConnectionAccepted", "doNotDisturb", "autoScroll", "reminderMorning", "reminderAfternoon", "reminderEvening", "reminderCustomTime", "createdAt", "updatedAt", "fcmToken", "bibleQuizLevel", "isCommunityRestricted", "mediaRestrictionExpiry", "verificationBadge", "coinBalance") SELECT "id", "email", "phoneNumber", "password", "firstName", "lastName", "username", "gender", "avatarUrl", "bio", "points", "devotionPoints", "dailyBreadPoints", "audioReelPoints", "videoReelPoints", "quizPoints", "streakCount", "isGuest", "isAdmin", "isBanned", "location", "appearance", "soundAlerts", "hapticFeedback", "music", "allNotifications", "inAppNotifications", "pushDirectMessages", "pushCommunityPosts", "pushCommunityForum", "pushConnectionRequests", "pushConnectionAccepted", "doNotDisturb", "autoScroll", "reminderMorning", "reminderAfternoon", "reminderEvening", "reminderCustomTime", "createdAt", "updatedAt", "fcmToken", "bibleQuizLevel", "isCommunityRestricted", "mediaRestrictionExpiry", "verificationBadge", "coinBalance" FROM `User`;--> statement-breakpoint
DROP TABLE `User`;--> statement-breakpoint
ALTER TABLE `__new_User` RENAME TO `User`;--> statement-breakpoint
CREATE UNIQUE INDEX `User_username_key` ON `User` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `User_phoneNumber_key` ON `User` (`phoneNumber`);--> statement-breakpoint
CREATE UNIQUE INDEX `User_email_key` ON `User` (`email`);--> statement-breakpoint
CREATE TABLE `__new_GlobalSettings` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`videoUploadSizeLimitMB` integer DEFAULT 50 NOT NULL,
	`videoUploadDurationLimitSec` integer DEFAULT 300 NOT NULL,
	`audioUploadSizeLimitMB` integer DEFAULT 50 NOT NULL,
	`audioUploadDurationLimitSec` integer DEFAULT 1800 NOT NULL,
	`devotionVideoSizeLimitMB` integer DEFAULT 50 NOT NULL,
	`devotionVideoDurationLimitSec` integer DEFAULT 300 NOT NULL,
	`registrationOtpEnabled` integer DEFAULT true NOT NULL,
	`otpMethod` text DEFAULT 'twilio' NOT NULL,
	`smtpHost` text,
	`smtpPort` integer,
	`smtpUser` text,
	`smtpPass` text,
	`smtpFrom` text,
	`updatedAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_GlobalSettings`("id", "videoUploadSizeLimitMB", "videoUploadDurationLimitSec", "audioUploadSizeLimitMB", "audioUploadDurationLimitSec", "devotionVideoSizeLimitMB", "devotionVideoDurationLimitSec", "registrationOtpEnabled", "otpMethod", "smtpHost", "smtpPort", "smtpUser", "smtpPass", "smtpFrom", "updatedAt") SELECT "id", "videoUploadSizeLimitMB", "videoUploadDurationLimitSec", "audioUploadSizeLimitMB", "audioUploadDurationLimitSec", "devotionVideoSizeLimitMB", "devotionVideoDurationLimitSec", "registrationOtpEnabled", "otpMethod", "smtpHost", "smtpPort", "smtpUser", "smtpPass", "smtpFrom", "updatedAt" FROM `GlobalSettings`;--> statement-breakpoint
DROP TABLE `GlobalSettings`;--> statement-breakpoint
ALTER TABLE `__new_GlobalSettings` RENAME TO `GlobalSettings`;--> statement-breakpoint
ALTER TABLE `Post` ADD `likesCount` integer DEFAULT 0 NOT NULL;