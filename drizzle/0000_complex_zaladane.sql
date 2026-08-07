-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE `_prisma_migrations` (
	`id` text PRIMARY KEY NOT NULL,
	`checksum` text NOT NULL,
	`finished_at` numeric,
	`migration_name` text NOT NULL,
	`logs` text,
	`rolled_back_at` numeric,
	`started_at` numeric DEFAULT (current_timestamp) NOT NULL,
	`applied_steps_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `OtpRequest` (
	`id` text PRIMARY KEY NOT NULL,
	`contact` text NOT NULL,
	`code` text NOT NULL,
	`expiresAt` numeric NOT NULL,
	`verified` numeric DEFAULT false NOT NULL,
	`userId` text,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `UserFeeling` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`feeling` text NOT NULL,
	`emoji` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `UserFeeling_userId_key` ON `UserFeeling` (`userId`);--> statement-breakpoint
CREATE TABLE `FriendRequest` (
	`id` text PRIMARY KEY NOT NULL,
	`senderId` text NOT NULL,
	`receiverId` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`receiverId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `DirectChat` (
	`id` text PRIMARY KEY NOT NULL,
	`user1Id` text NOT NULL,
	`user2Id` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user2Id`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`user1Id`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `DirectMessage` (
	`id` text PRIMARY KEY NOT NULL,
	`chatId` text NOT NULL,
	`senderId` text NOT NULL,
	`text` text NOT NULL,
	`image` text,
	`isRead` numeric DEFAULT false NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`chatId`) REFERENCES `DirectChat`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ChatPin` (
	`id` text PRIMARY KEY NOT NULL,
	`chatId` text NOT NULL,
	`userId` text NOT NULL,
	`pinnedAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`chatId`) REFERENCES `DirectChat`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `JournalEntry` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`title` text NOT NULL,
	`bodyText` text NOT NULL,
	`feelings` text NOT NULL,
	`verses` text,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `PersonalNote` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`title` text NOT NULL,
	`bodyText` text NOT NULL,
	`isFavorite` numeric DEFAULT false NOT NULL,
	`images` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`verses` text,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `Post` (
	`id` text PRIMARY KEY NOT NULL,
	`communityId` text NOT NULL,
	`userId` text NOT NULL,
	`text` text NOT NULL,
	`image` text,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `PostReaction` (
	`id` text PRIMARY KEY NOT NULL,
	`postId` text NOT NULL,
	`userId` text NOT NULL,
	`emoji` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `CommunityEvent` (
	`id` text PRIMARY KEY NOT NULL,
	`communityId` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`date` text NOT NULL,
	`time` text NOT NULL,
	`location` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`imageUrl` text,
	`link` text,
	FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `EventAttendee` (
	`id` text PRIMARY KEY NOT NULL,
	`eventId` text NOT NULL,
	`userId` text NOT NULL,
	`joined` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`eventId`) REFERENCES `CommunityEvent`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `GroupMessage` (
	`id` text PRIMARY KEY NOT NULL,
	`communityId` text NOT NULL,
	`senderId` text NOT NULL,
	`text` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`imageUrl` text,
	`audioThumbnail` text,
	`audioUrl` text,
	`videoThumbnail` text,
	`videoUrl` text,
	FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `BibleBookmark` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`verseRef` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `BibleHighlight` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`verseRef` text NOT NULL,
	`color` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `BibleNote` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`verseRef` text NOT NULL,
	`noteText` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `BibleReadingHistory` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`verseRef` text NOT NULL,
	`readAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `DevotionDay` (
	`id` text PRIMARY KEY NOT NULL,
	`planId` text NOT NULL,
	`dayNumber` integer NOT NULL,
	`title` text NOT NULL,
	`bodyText` text NOT NULL,
	`image` text,
	`pointsEarned` integer DEFAULT 20 NOT NULL,
	`likesCount` integer DEFAULT 0 NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`videoUrl` text,
	FOREIGN KEY (`planId`) REFERENCES `DevotionPlan`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `UserPlanProgress` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`planId` text NOT NULL,
	`currentDay` integer DEFAULT 1 NOT NULL,
	`reminderTime` text DEFAULT '09:41 AM' NOT NULL,
	`reminderEnabled` numeric DEFAULT true NOT NULL,
	`startedAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`completedAt` numeric,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `PlayProgress` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`mediaId` text NOT NULL,
	`progressSeconds` integer DEFAULT 0 NOT NULL,
	`completed` numeric DEFAULT false NOT NULL,
	`updatedAt` numeric NOT NULL,
	FOREIGN KEY (`mediaId`) REFERENCES `SermonMedia`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `Quiz` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`difficulty` text NOT NULL,
	`points` integer DEFAULT 50 NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Question` (
	`id` text PRIMARY KEY NOT NULL,
	`quizId` text NOT NULL,
	`questionText` text NOT NULL,
	`options` text NOT NULL,
	`correctAnswerIndex` integer NOT NULL,
	`points` integer DEFAULT 10 NOT NULL,
	FOREIGN KEY (`quizId`) REFERENCES `Quiz`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `QuizAttempt` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`quizId` text NOT NULL,
	`score` integer NOT NULL,
	`pointsEarned` integer NOT NULL,
	`completedAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`quizId`) REFERENCES `Quiz`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `DailyBread` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`puzzleData` text NOT NULL,
	`solution` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `DailyBread_date_key` ON `DailyBread` (`date`);--> statement-breakpoint
CREATE TABLE `DailyBreadAttempt` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`dailyBreadId` text NOT NULL,
	`solved` numeric DEFAULT false NOT NULL,
	`streakAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`dailyBreadId`) REFERENCES `DailyBread`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `Challenge` (
	`id` text PRIMARY KEY NOT NULL,
	`creatorId` text NOT NULL,
	`opponentId` text,
	`quizId` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`inviteCode` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`opponentId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Challenge_inviteCode_key` ON `Challenge` (`inviteCode`);--> statement-breakpoint
CREATE TABLE `ChallengeParticipant` (
	`id` text PRIMARY KEY NOT NULL,
	`challengeId` text NOT NULL,
	`userId` text NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`completed` numeric DEFAULT false NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`challengeId`) REFERENCES `Challenge`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `Badge` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`imageUrl` text NOT NULL,
	`criteriaType` text NOT NULL,
	`criteriaValue` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Badge_name_key` ON `Badge` (`name`);--> statement-breakpoint
CREATE TABLE `EarnedBadge` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`badgeId` text NOT NULL,
	`earnedAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`badgeId`) REFERENCES `Badge`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `Notification` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`type` text DEFAULT 'SYSTEM' NOT NULL,
	`isRead` numeric DEFAULT false NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `AppFeature` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`isEnabled` numeric DEFAULT true NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updatedAt` numeric NOT NULL,
	`value` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `AppFeature_key_key` ON `AppFeature` (`key`);--> statement-breakpoint
CREATE TABLE `LoginHistory` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`ip` text,
	`browser` text,
	`os` text,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `WordMatchQuestion` (
	`id` text PRIMARY KEY NOT NULL,
	`word` text NOT NULL,
	`match` text NOT NULL,
	`difficulty` text DEFAULT 'easy' NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updatedAt` numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE `WordCrossQuestion` (
	`id` text PRIMARY KEY NOT NULL,
	`word` text NOT NULL,
	`clue` text NOT NULL,
	`difficulty` text DEFAULT 'easy' NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updatedAt` numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE `GameSettings` (
	`id` text PRIMARY KEY NOT NULL,
	`gameType` text NOT NULL,
	`totalQuestions` integer DEFAULT 10 NOT NULL,
	`durationSecs` integer DEFAULT 60 NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updatedAt` numeric NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `GameSettings_gameType_key` ON `GameSettings` (`gameType`);--> statement-breakpoint
CREATE TABLE `GameScore` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`gameType` text NOT NULL,
	`difficulty` text NOT NULL,
	`score` integer NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `DailyVerseStat` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`likes` integer DEFAULT 0 NOT NULL,
	`shares` integer DEFAULT 0 NOT NULL,
	`comments` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `DailyVerseStat_date_key` ON `DailyVerseStat` (`date`);--> statement-breakpoint
CREATE TABLE `DailyVerseLike` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`date` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `DailyVerseLike_userId_date_key` ON `DailyVerseLike` (`userId`,`date`);--> statement-breakpoint
CREATE TABLE `BibleQuizQuestion` (
	`id` text PRIMARY KEY NOT NULL,
	`questionText` text NOT NULL,
	`options` text NOT NULL,
	`correctAnswerIndex` integer NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updatedAt` numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE `BookComment` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`bookId` text NOT NULL,
	`userId` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`bookId`) REFERENCES `Book`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `BookReaction` (
	`id` text PRIMARY KEY NOT NULL,
	`bookId` text NOT NULL,
	`userId` text NOT NULL,
	`emoji` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`bookId`) REFERENCES `Book`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `BookReaction_bookId_userId_emoji_key` ON `BookReaction` (`bookId`,`userId`,`emoji`);--> statement-breakpoint
CREATE TABLE `MediaLike` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`mediaId` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`mediaId`) REFERENCES `SermonMedia`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `MediaLike_userId_mediaId_key` ON `MediaLike` (`userId`,`mediaId`);--> statement-breakpoint
CREATE TABLE `PostReport` (
	`id` text PRIMARY KEY NOT NULL,
	`postId` text NOT NULL,
	`userId` text NOT NULL,
	`reason` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `CommentReaction` (
	`id` text PRIMARY KEY NOT NULL,
	`commentId` text NOT NULL,
	`userId` text NOT NULL,
	`emoji` text DEFAULT '👍' NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`commentId`) REFERENCES `Comment`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `CommentReaction_userId_commentId_key` ON `CommentReaction` (`userId`,`commentId`);--> statement-breakpoint
CREATE TABLE `Comment` (
	`id` text PRIMARY KEY NOT NULL,
	`postId` text NOT NULL,
	`userId` text NOT NULL,
	`parentId` text,
	`text` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`parentId`) REFERENCES `Comment`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `SermonMedia` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`author` text NOT NULL,
	`mediaUrl` text NOT NULL,
	`imageUrl` text NOT NULL,
	`type` text NOT NULL,
	`duration` text NOT NULL,
	`category` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ChatClear` (
	`id` text PRIMARY KEY NOT NULL,
	`chatId` text NOT NULL,
	`userId` text NOT NULL,
	`clearedAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`chatId`) REFERENCES `DirectChat`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ChatClear_chatId_userId_key` ON `ChatClear` (`chatId`,`userId`);--> statement-breakpoint
CREATE TABLE `DevotionDayLike` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`dayId` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`dayId`) REFERENCES `DevotionDay`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `DevotionDayLike_userId_dayId_key` ON `DevotionDayLike` (`userId`,`dayId`);--> statement-breakpoint
CREATE TABLE `Affirmation` (
	`id` text PRIMARY KEY NOT NULL,
	`feeling` text,
	`text` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Subscription` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`platform` text NOT NULL,
	`status` text NOT NULL,
	`originalTxId` text NOT NULL,
	`productId` text NOT NULL,
	`expiresAt` numeric NOT NULL,
	`isAutoRenewing` numeric DEFAULT true NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updatedAt` numeric NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Subscription_originalTxId_key` ON `Subscription` (`originalTxId`);--> statement-breakpoint
CREATE TABLE `UserMedia` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`title` text NOT NULL,
	`mediaUrl` text NOT NULL,
	`type` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updatedAt` numeric NOT NULL,
	`imageUrl` text,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `CommunityJoinRequest` (
	`id` text PRIMARY KEY NOT NULL,
	`communityId` text NOT NULL,
	`userId` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `Community` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`image` text,
	`guidelines` text,
	`isPrivate` numeric DEFAULT false NOT NULL,
	`isForumDisabledGlobally` numeric DEFAULT false NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`creatorId` text,
	FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Community_name_key` ON `Community` (`name`);--> statement-breakpoint
CREATE TABLE `CommunityMember` (
	`id` text PRIMARY KEY NOT NULL,
	`communityId` text NOT NULL,
	`userId` text NOT NULL,
	`role` text DEFAULT 'MEMBER' NOT NULL,
	`isSuspended` numeric DEFAULT false NOT NULL,
	`canPostForum` numeric DEFAULT true NOT NULL,
	`joinedAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `CommunityMessageLike` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`messageId` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`messageId`) REFERENCES `CommunityMessage`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `CommunityMessageLike_userId_messageId_key` ON `CommunityMessageLike` (`userId`,`messageId`);--> statement-breakpoint
CREATE TABLE `CommunityMessageBookmark` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`messageId` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`messageId`) REFERENCES `CommunityMessage`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `CommunityMessageBookmark_userId_messageId_key` ON `CommunityMessageBookmark` (`userId`,`messageId`);--> statement-breakpoint
CREATE TABLE `CommunityMessageComment` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`messageId` text NOT NULL,
	`text` text NOT NULL,
	`parentId` text,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`likesCount` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`parentId`) REFERENCES `CommunityMessageComment`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`messageId`) REFERENCES `CommunityMessage`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `SavedBook` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`bookId` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`bookId`) REFERENCES `Book`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `SavedBook_userId_bookId_key` ON `SavedBook` (`userId`,`bookId`);--> statement-breakpoint
CREATE TABLE `CommunityDailyVerse` (
	`id` text PRIMARY KEY NOT NULL,
	`communityId` text NOT NULL,
	`date` text NOT NULL,
	`reference` text NOT NULL,
	`text` text NOT NULL,
	`explanation` text,
	`likesCount` integer DEFAULT 0 NOT NULL,
	`sharesCount` integer DEFAULT 0 NOT NULL,
	`commentsCount` integer DEFAULT 0 NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `CommunityDailyVerse_communityId_date_key` ON `CommunityDailyVerse` (`communityId`,`date`);--> statement-breakpoint
CREATE TABLE `CommunityDailyVerseLike` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`verseId` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`verseId`) REFERENCES `CommunityDailyVerse`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `CommunityDailyVerseLike_userId_verseId_key` ON `CommunityDailyVerseLike` (`userId`,`verseId`);--> statement-breakpoint
CREATE TABLE `CommunityMessageReaction` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`messageId` text NOT NULL,
	`emoji` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`messageId`) REFERENCES `CommunityMessage`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `CommunityMessageReaction_userId_messageId_emoji_key` ON `CommunityMessageReaction` (`userId`,`messageId`,`emoji`);--> statement-breakpoint
CREATE TABLE `CommunityMessageCommentLike` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`commentId` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`commentId`) REFERENCES `CommunityMessageComment`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `CommunityMessageCommentLike_userId_commentId_key` ON `CommunityMessageCommentLike` (`userId`,`commentId`);--> statement-breakpoint
CREATE TABLE `CommunityMessage` (
	`id` text PRIMARY KEY NOT NULL,
	`communityId` text NOT NULL,
	`senderId` text NOT NULL,
	`text` text NOT NULL,
	`title` text,
	`imageUrl` text,
	`videoUrl` text,
	`videoThumbnail` text,
	`audioUrl` text,
	`audioThumbnail` text,
	`likesCount` integer DEFAULT 0 NOT NULL,
	`commentsCount` integer DEFAULT 0 NOT NULL,
	`sharesCount` integer DEFAULT 0 NOT NULL,
	`bookmarksCount` integer DEFAULT 0 NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `Report` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`itemType` text NOT NULL,
	`itemId` text NOT NULL,
	`reportedUserId` text,
	`reason` text NOT NULL,
	`details` text,
	`attachedMessages` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `SystemSetting` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `CoinTransaction` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`amount` integer NOT NULL,
	`type` text NOT NULL,
	`description` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `CoinPackage` (
	`id` text PRIMARY KEY NOT NULL,
	`amount` integer NOT NULL,
	`price` real NOT NULL,
	`validityDays` integer,
	`storeProductId` text,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `AdminAuditLog` (
	`id` text PRIMARY KEY NOT NULL,
	`adminId` text NOT NULL,
	`targetId` text NOT NULL,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Book` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`author` text NOT NULL,
	`description` text,
	`imageUrl` text,
	`downloadUrl` text,
	`topic` text,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updatedAt` numeric NOT NULL,
	`status` text DEFAULT 'APPROVED' NOT NULL,
	`authorId` text,
	`originalId` text,
	FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `DevotionPlan` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`image` text,
	`durationDays` integer NOT NULL,
	`authorName` text NOT NULL,
	`authorHandle` text NOT NULL,
	`tag` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`status` text DEFAULT 'APPROVED' NOT NULL,
	`authorId` text,
	`originalId` text,
	FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `User` (
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
	`isGuest` numeric DEFAULT false NOT NULL,
	`isAdmin` numeric DEFAULT false NOT NULL,
	`isBanned` numeric DEFAULT false NOT NULL,
	`location` text,
	`appearance` text DEFAULT 'system' NOT NULL,
	`soundAlerts` numeric DEFAULT true NOT NULL,
	`hapticFeedback` numeric DEFAULT true NOT NULL,
	`music` numeric DEFAULT true NOT NULL,
	`allNotifications` numeric DEFAULT true NOT NULL,
	`inAppNotifications` numeric DEFAULT true NOT NULL,
	`pushDirectMessages` numeric DEFAULT true NOT NULL,
	`pushCommunityPosts` numeric DEFAULT true NOT NULL,
	`pushCommunityForum` numeric DEFAULT true NOT NULL,
	`pushConnectionRequests` numeric DEFAULT true NOT NULL,
	`pushConnectionAccepted` numeric DEFAULT true NOT NULL,
	`doNotDisturb` numeric DEFAULT false NOT NULL,
	`autoScroll` numeric DEFAULT false NOT NULL,
	`reminderMorning` numeric DEFAULT false NOT NULL,
	`reminderAfternoon` numeric DEFAULT false NOT NULL,
	`reminderEvening` numeric DEFAULT false NOT NULL,
	`reminderCustomTime` text,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updatedAt` numeric NOT NULL,
	`fcmToken` text,
	`bibleQuizLevel` integer DEFAULT 1 NOT NULL,
	`isCommunityRestricted` numeric DEFAULT false NOT NULL,
	`mediaRestrictionExpiry` numeric,
	`verificationBadge` text DEFAULT 'NONE' NOT NULL,
	`coinBalance` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `User_username_key` ON `User` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `User_phoneNumber_key` ON `User` (`phoneNumber`);--> statement-breakpoint
CREATE UNIQUE INDEX `User_email_key` ON `User` (`email`);--> statement-breakpoint
CREATE TABLE `GlobalSettings` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`videoUploadSizeLimitMB` integer DEFAULT 50 NOT NULL,
	`videoUploadDurationLimitSec` integer DEFAULT 300 NOT NULL,
	`audioUploadSizeLimitMB` integer DEFAULT 50 NOT NULL,
	`audioUploadDurationLimitSec` integer DEFAULT 1800 NOT NULL,
	`devotionVideoSizeLimitMB` integer DEFAULT 50 NOT NULL,
	`devotionVideoDurationLimitSec` integer DEFAULT 300 NOT NULL,
	`registrationOtpEnabled` numeric DEFAULT true NOT NULL,
	`otpMethod` text DEFAULT 'twilio' NOT NULL,
	`smtpHost` text,
	`smtpPort` integer,
	`smtpUser` text,
	`smtpPass` text,
	`smtpFrom` text,
	`updatedAt` numeric NOT NULL
);

*/