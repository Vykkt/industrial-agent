CREATE TABLE `execution_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketId` int NOT NULL,
	`messageId` int,
	`toolId` int,
	`toolName` varchar(128) NOT NULL,
	`input` json,
	`output` json,
	`status` enum('success','failed','timeout') NOT NULL,
	`errorMessage` text,
	`executionTime` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `execution_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledge` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(256) NOT NULL,
	`content` text NOT NULL,
	`category` enum('equipment_manual','fault_case','process_spec','operation_guide','troubleshooting','best_practice') NOT NULL,
	`tags` json,
	`systemType` enum('erp','mes','plm','scada','oa','iam','hr','general') NOT NULL DEFAULT 'general',
	`embedding` text,
	`viewCount` int NOT NULL DEFAULT 0,
	`helpfulCount` int NOT NULL DEFAULT 0,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `knowledge_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketId` int NOT NULL,
	`role` enum('user','assistant','system','tool') NOT NULL,
	`content` text NOT NULL,
	`toolName` varchar(128),
	`toolInput` json,
	`toolOutput` json,
	`reasoning` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(128) NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `system_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_config_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketNo` varchar(32) NOT NULL,
	`title` varchar(256) NOT NULL,
	`description` text NOT NULL,
	`category` enum('erp_finance','erp_inventory','mes_production','mes_quality','plm_design','plm_bom','scada_alarm','scada_data','oa_workflow','iam_permission','hr_attendance','other') NOT NULL DEFAULT 'other',
	`priority` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
	`status` enum('pending','processing','waiting_feedback','resolved','closed','failed') NOT NULL DEFAULT 'pending',
	`userId` int NOT NULL,
	`assignedTo` int,
	`resolution` text,
	`agentSummary` text,
	`toolsUsed` json,
	`responseTime` int,
	`resolveTime` int,
	`satisfaction` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`resolvedAt` timestamp,
	CONSTRAINT `tickets_id` PRIMARY KEY(`id`),
	CONSTRAINT `tickets_ticketNo_unique` UNIQUE(`ticketNo`)
);
--> statement-breakpoint
CREATE TABLE `tools` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`displayName` varchar(128) NOT NULL,
	`description` text NOT NULL,
	`category` enum('erp','mes','plm','scada','oa','iam','hr','knowledge') NOT NULL,
	`parameters` json NOT NULL,
	`returnSchema` json,
	`endpoint` varchar(512),
	`isEnabled` boolean NOT NULL DEFAULT true,
	`usageCount` int NOT NULL DEFAULT 0,
	`successRate` float DEFAULT 100,
	`avgResponseTime` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tools_id` PRIMARY KEY(`id`),
	CONSTRAINT `tools_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `department` varchar(128);