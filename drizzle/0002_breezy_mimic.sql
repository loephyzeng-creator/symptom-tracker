CREATE TABLE `article_read_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`articleId` int NOT NULL,
	`readAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `article_read_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `health_articles` ADD `userId` int;