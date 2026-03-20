CREATE TABLE `alert_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`ruleId` int NOT NULL,
	`metricKey` varchar(50) NOT NULL,
	`message` text NOT NULL,
	`triggeredDate` varchar(10) NOT NULL,
	`isRead` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alert_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `alert_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`metricKey` varchar(50) NOT NULL,
	`threshold` int NOT NULL DEFAULT 7,
	`consecutiveDays` int NOT NULL DEFAULT 3,
	`direction` enum('above','below') NOT NULL DEFAULT 'above',
	`enabled` int NOT NULL DEFAULT 1,
	`lastTriggeredDate` varchar(10),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `alert_rules_id` PRIMARY KEY(`id`)
);
