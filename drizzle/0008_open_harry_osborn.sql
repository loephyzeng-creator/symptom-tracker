ALTER TABLE `medication_reminders` ADD `repeatDays` json DEFAULT ('[0,1,2,3,4,5,6]') NOT NULL;--> statement-breakpoint
ALTER TABLE `medication_reminders` ADD `offsetMinutes` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `medication_reminders` ADD `snoozedUntil` varchar(20);