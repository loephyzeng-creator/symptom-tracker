CREATE TABLE `medication_restocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`reminderId` int NOT NULL,
	`restockQuantity` int NOT NULL,
	`restockDate` varchar(10) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `medication_restocks_id` PRIMARY KEY(`id`)
);
