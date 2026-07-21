CREATE TABLE `partnerOrderItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partnerOrderId` int NOT NULL,
	`supplierCatalogId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`quantity` int NOT NULL,
	`unitPrice` int NOT NULL,
	`totalPrice` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `partnerOrderItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `partnerOrders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`terreiroId` int NOT NULL,
	`subtotal` int NOT NULL,
	`status` enum('pendente','confirmado','entregue','cancelado') NOT NULL DEFAULT 'pendente',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `partnerOrders_id` PRIMARY KEY(`id`)
);
