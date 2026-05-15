ALTER TABLE `medication_reminders` ADD `timesChangedDate` varchar(10);--> statement-breakpoint
ALTER TABLE `medication_reminders` ADD `previousReminderTimes` json;