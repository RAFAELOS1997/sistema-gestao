CREATE TABLE `partnerTiers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `partnerTiers_id` PRIMARY KEY(`id`),
	CONSTRAINT `partnerTiers_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `tierProductPrices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tierId` int NOT NULL,
	`productId` int NOT NULL,
	`price` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tierProductPrices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `terreiros` ADD `tierId` int;