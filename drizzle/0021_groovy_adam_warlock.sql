ALTER TABLE `partnerOrderItems` MODIFY COLUMN `supplierCatalogId` int;--> statement-breakpoint
ALTER TABLE `partnerOrderItems` ADD `source` enum('catalogo','estoque') DEFAULT 'catalogo' NOT NULL;--> statement-breakpoint
ALTER TABLE `partnerOrderItems` ADD `productId` int;