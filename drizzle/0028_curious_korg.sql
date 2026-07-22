ALTER TABLE `partnerOrders` ADD `shippingCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `partnerOrders` ADD `trackingCode` varchar(100);--> statement-breakpoint
ALTER TABLE `partnerOrders` ADD `carrier` varchar(100);--> statement-breakpoint
ALTER TABLE `publicOrders` ADD `shippingMethod` enum('retirada','envio') DEFAULT 'retirada' NOT NULL;--> statement-breakpoint
ALTER TABLE `publicOrders` ADD `shippingZipCode` varchar(9);--> statement-breakpoint
ALTER TABLE `publicOrders` ADD `shippingStreet` varchar(255);--> statement-breakpoint
ALTER TABLE `publicOrders` ADD `shippingNumber` varchar(20);--> statement-breakpoint
ALTER TABLE `publicOrders` ADD `shippingComplement` varchar(100);--> statement-breakpoint
ALTER TABLE `publicOrders` ADD `shippingNeighborhood` varchar(100);--> statement-breakpoint
ALTER TABLE `publicOrders` ADD `shippingCity` varchar(100);--> statement-breakpoint
ALTER TABLE `publicOrders` ADD `shippingState` varchar(2);--> statement-breakpoint
ALTER TABLE `publicOrders` ADD `shippingCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `publicOrders` ADD `trackingCode` varchar(100);--> statement-breakpoint
ALTER TABLE `publicOrders` ADD `carrier` varchar(100);--> statement-breakpoint
ALTER TABLE `systemConfig` ADD `shippingLocalCity` varchar(100) DEFAULT 'Ribeirão Preto';--> statement-breakpoint
ALTER TABLE `systemConfig` ADD `shippingLocalState` varchar(2) DEFAULT 'SP';--> statement-breakpoint
ALTER TABLE `systemConfig` ADD `shippingLocalCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `systemConfig` ADD `shippingStateCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `systemConfig` ADD `shippingNationalCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `terreiros` ADD `shippingZipCode` varchar(9);--> statement-breakpoint
ALTER TABLE `terreiros` ADD `shippingStreet` varchar(255);--> statement-breakpoint
ALTER TABLE `terreiros` ADD `shippingNumber` varchar(20);--> statement-breakpoint
ALTER TABLE `terreiros` ADD `shippingComplement` varchar(100);--> statement-breakpoint
ALTER TABLE `terreiros` ADD `shippingNeighborhood` varchar(100);--> statement-breakpoint
ALTER TABLE `terreiros` ADD `shippingCity` varchar(100);--> statement-breakpoint
ALTER TABLE `terreiros` ADD `shippingState` varchar(2);