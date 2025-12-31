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
