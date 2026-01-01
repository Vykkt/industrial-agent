import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean, float } from "drizzle-orm/mysql-core";

/**
 * 用户表 - 系统用户（信息科人员）
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  department: varchar("department", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 工单表 - 问题工单管理
 */
export const tickets = mysqlTable("tickets", {
  id: int("id").autoincrement().primaryKey(),
  ticketNo: varchar("ticketNo", { length: 32 }).notNull().unique(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description").notNull(),
  category: mysqlEnum("category", [
    "erp_finance", "erp_inventory", "mes_production", "mes_quality",
    "plm_design", "plm_bom", "scada_alarm", "scada_data",
    "oa_workflow", "iam_permission", "hr_attendance", "other"
  ]).default("other").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium").notNull(),
  status: mysqlEnum("status", [
    "pending", "processing", "waiting_feedback", "resolved", "closed", "failed"
  ]).default("pending").notNull(),
  userId: int("userId").notNull(),
  assignedTo: int("assignedTo"),
  resolution: text("resolution"),
  agentSummary: text("agentSummary"),
  toolsUsed: json("toolsUsed").$type<string[]>(),
  responseTime: int("responseTime"),
  resolveTime: int("resolveTime"),
  satisfaction: int("satisfaction"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
});

export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = typeof tickets.$inferInsert;

/**
 * 对话消息表 - 存储与Agent的对话记录
 */
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  ticketId: int("ticketId").notNull(),
  role: mysqlEnum("role", ["user", "assistant", "system", "tool"]).notNull(),
  content: text("content").notNull(),
  toolName: varchar("toolName", { length: 128 }),
  toolInput: json("toolInput"),
  toolOutput: json("toolOutput"),
  reasoning: text("reasoning"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

/**
 * 工具注册表 - 管理可用的工业软件API工具
 */
export const tools = mysqlTable("tools", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  displayName: varchar("displayName", { length: 128 }).notNull(),
  description: text("description").notNull(),
  category: mysqlEnum("category", [
    "erp", "mes", "plm", "scada", "oa", "iam", "hr", "knowledge"
  ]).notNull(),
  parameters: json("parameters").$type<{
    name: string;
    type: string;
    description: string;
    required: boolean;
    enum?: string[];
  }[]>().notNull(),
  returnSchema: json("returnSchema"),
  endpoint: varchar("endpoint", { length: 512 }),
  isEnabled: boolean("isEnabled").default(true).notNull(),
  usageCount: int("usageCount").default(0).notNull(),
  successRate: float("successRate").default(100),
  avgResponseTime: int("avgResponseTime").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Tool = typeof tools.$inferSelect;
export type InsertTool = typeof tools.$inferInsert;

/**
 * 知识库表 - 存储工业知识文档
 */
export const knowledge = mysqlTable("knowledge", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 256 }).notNull(),
  content: text("content").notNull(),
  category: mysqlEnum("category", [
    "equipment_manual", "fault_case", "process_spec",
    "operation_guide", "troubleshooting", "best_practice"
  ]).notNull(),
  tags: json("tags").$type<string[]>(),
  systemType: mysqlEnum("systemType", [
    "erp", "mes", "plm", "scada", "oa", "iam", "hr", "general"
  ]).default("general").notNull(),
  embedding: text("embedding"),
  viewCount: int("viewCount").default(0).notNull(),
  helpfulCount: int("helpfulCount").default(0).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Knowledge = typeof knowledge.$inferSelect;
export type InsertKnowledge = typeof knowledge.$inferInsert;

/**
 * 执行日志表 - 记录工具调用和Agent执行日志
 */
export const executionLogs = mysqlTable("execution_logs", {
  id: int("id").autoincrement().primaryKey(),
  ticketId: int("ticketId").notNull(),
  messageId: int("messageId"),
  toolId: int("toolId"),
  toolName: varchar("toolName", { length: 128 }).notNull(),
  input: json("input"),
  output: json("output"),
  status: mysqlEnum("status", ["success", "failed", "timeout"]).notNull(),
  errorMessage: text("errorMessage"),
  executionTime: int("executionTime").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ExecutionLog = typeof executionLogs.$inferSelect;
export type InsertExecutionLog = typeof executionLogs.$inferInsert;

/**
 * 系统配置表 - 存储Agent配置
 */
export const systemConfig = mysqlTable("system_config", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SystemConfig = typeof systemConfig.$inferSelect;
export type InsertSystemConfig = typeof systemConfig.$inferInsert;

/**
 * 系统连接配置表 - 存储MES/ERP等系统的连接信息
 * P0改进：支持灵活的现场配置
 */
export const systemConnections = mysqlTable("system_connections", {
  id: int("id").autoincrement().primaryKey(),
  systemType: mysqlEnum("systemType", [
    "kingdee", "yonyou", "sap", "oracle", "custom"
  ]).notNull(),
  systemName: varchar("systemName", { length: 128 }).notNull(),
  apiEndpoint: varchar("apiEndpoint", { length: 512 }).notNull(),
  authType: mysqlEnum("authType", [
    "basic", "oauth2", "api_key", "custom"
  ]).notNull(),
  authConfig: json("authConfig").$type<Record<string, any>>().notNull(),
  status: mysqlEnum("status", [
    "active", "inactive", "testing", "failed"
  ]).default("inactive").notNull(),
  lastTestedAt: timestamp("lastTestedAt"),
  testResult: json("testResult"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SystemConnection = typeof systemConnections.$inferSelect;
export type InsertSystemConnection = typeof systemConnections.$inferInsert;

/**
 * 工具配置表 - 存储工具的运行时配置
 * P0改进：支持工具的灵活配置和模式切换
 */
export const toolConfigurations = mysqlTable("tool_configurations", {
  id: int("id").autoincrement().primaryKey(),
  toolId: int("toolId").notNull(),
  executionMode: mysqlEnum("executionMode", [
    "mock", "simulation", "real", "dry_run"
  ]).default("mock").notNull(),
  mockData: json("mockData"),
  parameters: json("parameters").$type<Record<string, any>>(),
  retryConfig: json("retryConfig").$type<{
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  }>(),
  timeoutMs: int("timeoutMs").default(30000),
  isEnabled: boolean("isEnabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ToolConfiguration = typeof toolConfigurations.$inferSelect;
export type InsertToolConfiguration = typeof toolConfigurations.$inferInsert;

/**
 * 工作流配置表 - 存储工作流定义
 * P0改进：支持工作流的持久化和配置管理
 */
export const workflowConfigurations = mysqlTable("workflow_configurations", {
  id: int("id").autoincrement().primaryKey(),
  workflowName: varchar("workflowName", { length: 128 }).notNull().unique(),
  description: text("description"),
  steps: json("steps").$type<Array<{
    id: string;
    name: string;
    type: string;
    toolId?: number;
    condition?: Record<string, any>;
    timeout?: number;
    retryable?: boolean;
  }>>().notNull(),
  branches: json("branches").$type<Array<{
    id: string;
    condition: Record<string, any>;
    targetStepId: string;
  }>>(),
  version: int("version").default(1).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkflowConfiguration = typeof workflowConfigurations.$inferSelect;
export type InsertWorkflowConfiguration = typeof workflowConfigurations.$inferInsert;

/**
 * 工作流执行事件表 - 事件溯源模式
 * P0改进：支持工作流持久化和恢复
 */
export const workflowEvents = mysqlTable("workflow_events", {
  id: int("id").autoincrement().primaryKey(),
  workflowExecutionId: varchar("workflowExecutionId", { length: 64 }).notNull(),
  eventType: mysqlEnum("eventType", [
    "started", "step_executed", "step_failed", "branch_taken",
    "paused", "resumed", "completed", "failed", "cancelled"
  ]).notNull(),
  eventData: json("eventData").$type<Record<string, any>>(),
  stepId: varchar("stepId", { length: 64 }),
  errorMessage: text("errorMessage"),
  version: int("version").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WorkflowEvent = typeof workflowEvents.$inferSelect;
export type InsertWorkflowEvent = typeof workflowEvents.$inferInsert;

/**
 * 工作流快照表 - 定期保存工作流状态
 * P0改进：支持快速恢复
 */
export const workflowSnapshots = mysqlTable("workflow_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  workflowExecutionId: varchar("workflowExecutionId", { length: 64 }).notNull().unique(),
  workflowConfigId: int("workflowConfigId").notNull(),
  state: json("state").$type<Record<string, any>>().notNull(),
  currentStepId: varchar("currentStepId", { length: 64 }),
  version: int("version").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkflowSnapshot = typeof workflowSnapshots.$inferSelect;
export type InsertWorkflowSnapshot = typeof workflowSnapshots.$inferInsert;

/**
 * 知识库切片表 - 支持向量检索
 * P1改进：支持RAG混合检索
 */
export const knowledgeChunks = mysqlTable("knowledge_chunks", {
  id: int("id").autoincrement().primaryKey(),
  knowledgeId: int("knowledgeId").notNull(),
  chunkIndex: int("chunkIndex").notNull(),
  content: text("content").notNull(),
  embedding: text("embedding"),
  metadata: json("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect;
export type InsertKnowledgeChunk = typeof knowledgeChunks.$inferInsert;

/**
 * 多Agent任务表 - 支持多智能体协同
 * P1改进：支持多Agent任务管理
 */
export const multiAgentTasks = mysqlTable("multi_agent_tasks", {
  id: int("id").autoincrement().primaryKey(),
  taskId: varchar("taskId", { length: 64 }).notNull().unique(),
  parentTaskId: varchar("parentTaskId", { length: 64 }),
  agentId: varchar("agentId", { length: 64 }).notNull(),
  taskType: mysqlEnum("taskType", [
    "lead", "sub", "parallel"
  ]).notNull(),
  objective: text("objective").notNull(),
  status: mysqlEnum("status", [
    "pending", "running", "completed", "failed", "cancelled"
  ]).default("pending").notNull(),
  result: json("result"),
  errorMessage: text("errorMessage"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MultiAgentTask = typeof multiAgentTasks.$inferSelect;
export type InsertMultiAgentTask = typeof multiAgentTasks.$inferInsert;

/**
 * Agent消息队列表 - 支持Agent间通信
 * P1改进：支持多Agent协同通信
 */
export const agentMessages = mysqlTable("agent_messages", {
  id: int("id").autoincrement().primaryKey(),
  messageId: varchar("messageId", { length: 64 }).notNull().unique(),
  fromAgentId: varchar("fromAgentId", { length: 64 }).notNull(),
  toAgentId: varchar("toAgentId", { length: 64 }).notNull(),
  messageType: mysqlEnum("messageType", [
    "task_assignment", "progress_update", "result", "error_recovery"
  ]).notNull(),
  messageData: json("messageData").$type<Record<string, any>>().notNull(),
  status: mysqlEnum("status", [
    "pending", "delivered", "processed", "failed"
  ]).default("pending").notNull(),
  retryCount: int("retryCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  processedAt: timestamp("processedAt"),
});

export type AgentMessage = typeof agentMessages.$inferSelect;
export type InsertAgentMessage = typeof agentMessages.$inferInsert;
