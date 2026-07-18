CREATE TABLE `terreiroProductPrices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`terreiroId` int NOT NULL,
	`productId` int NOT NULL,
	`price` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `terreiroProductPrices_id` PRIMARY KEY(`id`)
);
