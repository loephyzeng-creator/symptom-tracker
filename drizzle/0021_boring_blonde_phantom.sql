ALTER TABLE `notification_settings` ADD `weeklyReportFrequency` enum('weekly','biweekly','monthly') DEFAULT 'weekly' NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_settings` ADD `weeklyReportHour` int DEFAULT 19 NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_settings` ADD `lastWeeklyReportDate` varchar(10);