CREATE TABLE `consignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`terreiroId` int NOT NULL,
	`productId` int NOT NULL,
	`quantity` int NOT NULL,
	`quantitySold` int NOT NULL DEFAULT 0,
	`quantityReturned` int NOT NULL DEFAULT 0,
	`unitPrice` int NOT NULL,
	`notes` text,
	`leftAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `consignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `sales` MODIFY COLUMN `channel` enum('fisico','instagram','terreiro') NOT NULL DEFAULT 'fisico';