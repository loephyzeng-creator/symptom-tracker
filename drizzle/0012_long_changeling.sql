ALTER TABLE `medication_reminders` ADD `expirationDate` varchar(10);--> statement-breakpoint
ALTER TABLE `medication_reminders` ADD `expirationAlertDays` int DEFAULT 30;--> statement-breakpoint
ALTER TABLE `medication_reminders` ADD `lastExpirationAlertDate` varchar(10);