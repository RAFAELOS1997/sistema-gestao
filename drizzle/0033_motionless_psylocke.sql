CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(255),
	`googleId` varchar(100),
	`phone` varchar(20),
	`shippingZipCode` varchar(9),
	`shippingStreet` varchar(255),
	`shippingNumber` varchar(20),
	`shippingComplement` varchar(100),
	`shippingNeighborhood` varchar(100),
	`shippingCity` varchar(100),
	`shippingState` varchar(2),
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customers_email_unique` UNIQUE(`email`),
	CONSTRAINT `customers_googleId_unique` UNIQUE(`googleId`)
);
--> statement-breakpoint
ALTER TABLE `publicOrders` ADD `customerId` int;