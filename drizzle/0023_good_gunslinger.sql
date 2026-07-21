ALTER TABLE `sales` MODIFY COLUMN `channel` enum('fisico','instagram','terreiro','site') NOT NULL DEFAULT 'fisico';--> statement-breakpoint
ALTER TABLE `infinitePayCharges` ADD `publicOrderId` int;--> statement-breakpoint
ALTER TABLE `publicOrders` ADD `paymentMethod` varchar(50);