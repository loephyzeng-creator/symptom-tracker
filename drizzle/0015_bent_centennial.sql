CREATE TABLE `drug_interactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`drugA` varchar(200) NOT NULL,
	`drugB` varchar(200) NOT NULL,
	`severity` enum('mild','moderate','severe') NOT NULL DEFAULT 'moderate',
	`description` text NOT NULL,
	`recommendation` text,
	`source` varchar(50) DEFAULT 'ai',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `drug_interactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `medication_reminders` ADD `intervalHours` int;--> statement-breakpoint
ALTER TABLE `medication_reminders` ADD `lastTakenAt` varchar(30);