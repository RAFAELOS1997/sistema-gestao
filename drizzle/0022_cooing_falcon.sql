CREATE TABLE `publicOrderItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicOrderId` int NOT NULL,
	`source` enum('catalogo','estoque') NOT NULL DEFAULT 'catalogo',
	`supplierCatalogId` int,
	`productId` int,
	`name` varchar(255) NOT NULL,
	`quantity` int NOT NULL,
	`unitPrice` int NOT NULL,
	`totalPrice` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `publicOrderItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `publicOrders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerName` varchar(255) NOT NULL,
	`customerPhone` varchar(20) NOT NULL,
	`subtotal` int NOT NULL,
	`status` enum('pendente','confirmado','entregue','cancelado') NOT NULL DEFAULT 'pendente',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `publicOrders_id` PRIMARY KEY(`id`)
);
