CREATE TABLE `trigger_tips` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`trigger` varchar(100) NOT NULL,
	`title` varchar(200),
	`recommended` json NOT NULL DEFAULT ('[]'),
	`avoid` json NOT NULL DEFAULT ('[]'),
	`tip` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trigger_tips_id` PRIMARY KEY(`id`)
);
