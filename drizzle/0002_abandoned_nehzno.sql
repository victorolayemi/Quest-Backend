CREATE TABLE `BookLike` (
	`id` text PRIMARY KEY NOT NULL,
	`bookId` text NOT NULL,
	`userId` text NOT NULL,
	`createdAt` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`bookId`) REFERENCES `Book`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `BookLike_bookId_userId_key` ON `BookLike` (`bookId`,`userId`);--> statement-breakpoint
ALTER TABLE `Book` ADD `likesCount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `Notification` ADD `data` text;