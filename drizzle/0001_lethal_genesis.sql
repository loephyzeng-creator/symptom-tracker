CREATE TABLE `custom_triggers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `custom_triggers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `symptom_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`dizziness` int NOT NULL DEFAULT 0,
	`headache` int NOT NULL DEFAULT 0,
	`sleepQuality` int NOT NULL DEFAULT 5,
	`anxiety` int NOT NULL DEFAULT 0,
	`fatigue` int NOT NULL DEFAULT 0,
	`photosensitivity` int NOT NULL DEFAULT 0,
	`motionSickness` int NOT NULL DEFAULT 0,
	`palpitations` int NOT NULL DEFAULT 0,
	`mood` int NOT NULL DEFAULT 5,
	`medications` json NOT NULL DEFAULT ('[]'),
	`triggers` json NOT NULL DEFAULT ('[]'),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `symptom_entries_id` PRIMARY KEY(`id`)
);
