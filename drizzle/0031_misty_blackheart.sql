ALTER TABLE `partnerApplications` ADD `source` enum('site','prospeccao') DEFAULT 'site' NOT NULL;--> statement-breakpoint
ALTER TABLE `partnerApplications` ADD `instagram` varchar(100);--> statement-breakpoint
ALTER TABLE `partnerApplications` ADD `address` text;