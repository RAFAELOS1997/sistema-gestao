CREATE TABLE `purchases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`quantity` int NOT NULL,
	`unitPrice` int NOT NULL,
	`totalPrice` int NOT NULL,
	`supplier` varchar(255) NOT NULL,
	`channel` enum('direto','distribuidor','fabricante') NOT NULL DEFAULT 'distribuidor',
	`purchaseDate` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `purchases_id` PRIMARY KEY(`id`)
);
