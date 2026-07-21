CREATE TABLE `partnerApplications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`terreiroName` varchar(255) NOT NULL,
	`contactName` varchar(255) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`city` varchar(100),
	`notes` text,
	`status` enum('pendente','aprovado','recusado') NOT NULL DEFAULT 'pendente',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `partnerApplications_id` PRIMARY KEY(`id`)
);
