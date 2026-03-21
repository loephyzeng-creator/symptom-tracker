CREATE TABLE `medication_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`icon` varchar(50) DEFAULT 'Pill',
	`color` varchar(20) DEFAULT 'sage',
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `medication_groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `medication_reminders` ADD `groupId` int;