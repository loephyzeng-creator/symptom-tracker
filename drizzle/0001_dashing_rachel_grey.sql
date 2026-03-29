CREATE TABLE `article_favorites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`articleId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `article_favorites_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `health_articles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`category` varchar(50) NOT NULL,
	`tags` json NOT NULL DEFAULT ('[]'),
	`summary` varchar(500) NOT NULL,
	`content` text NOT NULL,
	`source` varchar(200),
	`relatedTriggers` json NOT NULL DEFAULT ('[]'),
	`isPreset` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `health_articles_id` PRIMARY KEY(`id`)
);
