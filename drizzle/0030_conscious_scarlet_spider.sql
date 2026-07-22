ALTER TABLE `publicOrders` ADD `couponCode` varchar(30);--> statement-breakpoint
ALTER TABLE `publicOrders` ADD `referredByTerreiroId` int;--> statement-breakpoint
ALTER TABLE `publicOrders` ADD `discountCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `terreiros` ADD `referralCode` varchar(30);--> statement-breakpoint
ALTER TABLE `terreiros` ADD CONSTRAINT `terreiros_referralCode_unique` UNIQUE(`referralCode`);