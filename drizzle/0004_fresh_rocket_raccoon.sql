CREATE TABLE `productSuppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`supplierId` int NOT NULL,
	`supplierProductCode` varchar(100),
	`costPrice` int NOT NULL,
	`minimumOrderQuantity` int DEFAULT 1,
	`leadTimeDays` int DEFAULT 7,
	`isPreferred` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `productSuppliers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320),
	`phone` varchar(20),
	`address` text,
	`city` varchar(100),
	`state` varchar(2),
	`zipCode` varchar(10),
	`cnpj` varchar(18),
	`paymentTerms` varchar(100),
	`isActive` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`)
);
