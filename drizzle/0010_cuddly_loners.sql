ALTER TABLE `medication_reminders` ADD `stockQuantity` int;--> statement-breakpoint
ALTER TABLE `medication_reminders` ADD `dailyDosageCount` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `medication_reminders` ADD `stockAlertDays` int DEFAULT 7;--> statement-breakpoint
ALTER TABLE `medication_reminders` ADD `lastStockAlertDate` varchar(10);