ALTER TABLE `notification_settings` ADD `painkillerAlertEnabled` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_settings` ADD `painkillerAlertLastDate` varchar(10);