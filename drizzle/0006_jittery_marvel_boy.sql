CREATE TABLE `receipts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`receiptNumber` int NOT NULL,
	`subtotal` int NOT NULL,
	`discount` int NOT NULL DEFAULT 0,
	`total` int NOT NULL,
	`paymentMethod` varchar(50) NOT NULL,
	`notes` text,
	`items` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `receipts_id` PRIMARY KEY(`id`),
	CONSTRAINT `receipts_receiptNumber_unique` UNIQUE(`receiptNumber`)
);
