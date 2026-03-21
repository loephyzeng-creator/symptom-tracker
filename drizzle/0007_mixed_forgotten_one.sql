CREATE TABLE `medication_reminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`medicationName` varchar(200) NOT NULL,
	`dosage` varchar(100) NOT NULL,
	`reminderHour` int NOT NULL,
	`reminderMinute` int NOT NULL,
	`enabled` int NOT NULL DEFAULT 1,
	`lastNotifiedDate` varchar(10),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `medication_reminders_id` PRIMARY KEY(`id`)
);
