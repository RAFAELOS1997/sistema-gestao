ALTER TABLE `systemConfig` ADD `shippingOriginZipCode` varchar(9) DEFAULT '14090210' NOT NULL;--> statement-breakpoint
ALTER TABLE `systemConfig` ADD `shippingPerKmCents` int DEFAULT 150 NOT NULL;--> statement-breakpoint
ALTER TABLE `systemConfig` ADD `shippingSupplierFixedCents` int DEFAULT 4000 NOT NULL;