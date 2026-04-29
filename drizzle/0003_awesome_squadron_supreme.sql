ALTER TABLE `notification_settings` ADD `autoReportEnabled` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_settings` ADD `autoReportFrequency` enum('weekly','monthly') DEFAULT 'weekly' NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_settings` ADD `lastAutoReportDate` varchar(10);