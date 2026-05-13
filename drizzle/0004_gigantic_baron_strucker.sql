ALTER TABLE `symptom_entries` ADD `socialAnxiety` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `symptom_entries` ADD `socialContext` json DEFAULT ('[]') NOT NULL;