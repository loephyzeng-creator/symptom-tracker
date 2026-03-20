CREATE TABLE `custom_metric_values` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entryId` int NOT NULL,
	`metricId` int NOT NULL,
	`value` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `custom_metric_values_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `custom_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` varchar(255),
	`icon` varchar(50) DEFAULT 'Activity',
	`isHighGood` int NOT NULL DEFAULT 0,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `custom_metrics_id` PRIMARY KEY(`id`)
);
