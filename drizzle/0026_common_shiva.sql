ALTER TABLE `terreiroUsers` ADD `mustChangePassword` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `terreiros` ADD `mustChangePassword` int DEFAULT 0 NOT NULL;