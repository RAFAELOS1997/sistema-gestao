CREATE TABLE `consignmentRequestItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`consignmentRequestId` int NOT NULL,
	`productId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`quantity` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `consignmentRequestItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consignmentRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`terreiroId` int NOT NULL,
	`status` enum('pendente','entregue','cancelado') NOT NULL DEFAULT 'pendente',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `consignmentRequests_id` PRIMARY KEY(`id`)
);
