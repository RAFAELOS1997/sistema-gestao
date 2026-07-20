CREATE TABLE `infinitePayCharges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderNsu` varchar(64) NOT NULL,
	`amountCents` int NOT NULL,
	`description` varchar(255),
	`checkoutUrl` text NOT NULL,
	`status` enum('pending','paid','failed') NOT NULL DEFAULT 'pending',
	`invoiceSlug` varchar(100),
	`transactionNsu` varchar(100),
	`paidAmountCents` int,
	`captureMethod` varchar(32),
	`receiptUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `infinitePayCharges_id` PRIMARY KEY(`id`),
	CONSTRAINT `infinitePayCharges_orderNsu_unique` UNIQUE(`orderNsu`)
);
--> statement-breakpoint
ALTER TABLE `systemConfig` ADD `infinitePayHandle` varchar(100);