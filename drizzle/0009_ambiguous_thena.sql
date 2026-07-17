CREATE TABLE `supplierCatalog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplierId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`category` enum('guias','pulseiras','velas','incensos','ervas','imagens','ferramentas','vestuario','livros','pedras','outros') NOT NULL,
	`sourceSlug` varchar(255) NOT NULL,
	`sourceUrl` text NOT NULL,
	`imageUrl` text,
	`price` int NOT NULL,
	`suggestedSalePrice` int,
	`stockStatus` enum('disponivel','indisponivel','desconhecido') NOT NULL DEFAULT 'desconhecido',
	`lastCheckedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `supplierCatalog_id` PRIMARY KEY(`id`)
);
