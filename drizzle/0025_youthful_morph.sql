CREATE TABLE `terreiroUsers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`terreiroId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`username` varchar(100) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp,
	CONSTRAINT `terreiroUsers_id` PRIMARY KEY(`id`),
	CONSTRAINT `terreiroUsers_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
ALTER TABLE `terreiros` ADD `logoUrl` mediumtext;