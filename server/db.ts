import { eq, desc, and, sql, gte, lte, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  tickets, InsertTicket, Ticket,
  messages, InsertMessage,
  tools, InsertTool, Tool,
  knowledge, InsertKnowledge,
  executionLogs, InsertExecutionLog,
  systemConfig
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { nanoid } from 'nanoid';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== 用户相关 ====================
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "department"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ==================== 工单相关 ====================
export async function createTicket(data: Omit<InsertTicket, 'ticketNo'>): Promise<Ticket> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const ticketNo = `TK${Date.now().toString(36).toUpperCase()}${nanoid(4).toUpperCase()}`;
  const [result] = await db.insert(tickets).values({ ...data, ticketNo }).$returningId();
  const [ticket] = await db.select().from(tickets).where(eq(tickets.id, result.id));
  return ticket;
}

export async function getTicketById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [ticket] = await db.select().from(tickets).where(eq(tickets.id, id));
  return ticket;
}

export async function getTicketByNo(ticketNo: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [ticket] = await db.select().from(tickets).where(eq(tickets.ticketNo, ticketNo));
  return ticket;
}

export async function listTickets(params: {
  userId?: number;
  status?: Ticket['status'];
  category?: Ticket['category'];
  priority?: Ticket['priority'];
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { tickets: [], total: 0 };

  const conditions = [];
  if (params.userId) conditions.push(eq(tickets.userId, params.userId));
  if (params.status) conditions.push(eq(tickets.status, params.status));
  if (params.category) conditions.push(eq(tickets.category, params.category));
  if (params.priority) conditions.push(eq(tickets.priority, params.priority));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const [countResult] = await db.select({ count: sql<number>`count(*)` })
    .from(tickets)
    .where(whereClause);
  
  const result = await db.select()
    .from(tickets)
    .where(whereClause)
    .orderBy(desc(tickets.createdAt))
    .limit(params.limit || 20)
    .offset(params.offset || 0);

  return { tickets: result, total: countResult.count };
}

export async function updateTicket(id: number, data: Partial<InsertTicket>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(tickets).set(data).where(eq(tickets.id, id));
  return getTicketById(id);
}

// ==================== 消息相关 ====================
export async function createMessage(data: InsertMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(messages).values(data).$returningId();
  const [message] = await db.select().from(messages).where(eq(messages.id, result.id));
  return message;
}

export async function getMessagesByTicketId(ticketId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(messages).where(eq(messages.ticketId, ticketId)).orderBy(messages.createdAt);
}

// ==================== 工具相关 ====================
export async function createTool(data: InsertTool) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(tools).values(data).$returningId();
  const [tool] = await db.select().from(tools).where(eq(tools.id, result.id));
  return tool;
}

export async function getToolById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [tool] = await db.select().from(tools).where(eq(tools.id, id));
  return tool;
}

export async function getToolByName(name: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [tool] = await db.select().from(tools).where(eq(tools.name, name));
  return tool;
}

export async function listTools(params: { category?: Tool['category']; isEnabled?: boolean } = {}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (params.category) conditions.push(eq(tools.category, params.category));
  if (params.isEnabled !== undefined) conditions.push(eq(tools.isEnabled, params.isEnabled));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(tools).where(whereClause).orderBy(tools.category, tools.name);
}

export async function updateTool(id: number, data: Partial<InsertTool>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(tools).set(data).where(eq(tools.id, id));
  return getToolById(id);
}

export async function deleteTool(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(tools).where(eq(tools.id, id));
}

export async function incrementToolUsage(id: number, success: boolean, responseTime: number) {
  const db = await getDb();
  if (!db) return;
  
  const tool = await getToolById(id);
  if (!tool) return;

  const newUsageCount = tool.usageCount + 1;
  const currentSuccessCount = Math.round((tool.successRate || 100) * tool.usageCount / 100);
  const newSuccessCount = success ? currentSuccessCount + 1 : currentSuccessCount;
  const newSuccessRate = (newSuccessCount / newUsageCount) * 100;
  const newAvgResponseTime = Math.round(
    ((tool.avgResponseTime || 0) * tool.usageCount + responseTime) / newUsageCount
  );

  await db.update(tools).set({
    usageCount: newUsageCount,
    successRate: newSuccessRate,
    avgResponseTime: newAvgResponseTime
  }).where(eq(tools.id, id));
}

// ==================== 知识库相关 ====================
export async function createKnowledge(data: InsertKnowledge) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(knowledge).values(data).$returningId();
  const [doc] = await db.select().from(knowledge).where(eq(knowledge.id, result.id));
  return doc;
}

export async function getKnowledgeById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [doc] = await db.select().from(knowledge).where(eq(knowledge.id, id));
  return doc;
}

export async function listKnowledge(params: {
  category?: typeof knowledge.$inferSelect['category'];
  systemType?: typeof knowledge.$inferSelect['systemType'];
  search?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const conditions = [];
  if (params.category) conditions.push(eq(knowledge.category, params.category));
  if (params.systemType) conditions.push(eq(knowledge.systemType, params.systemType));
  if (params.search) {
    conditions.push(or(
      like(knowledge.title, `%${params.search}%`),
      like(knowledge.content, `%${params.search}%`)
    ));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db.select({ count: sql<number>`count(*)` })
    .from(knowledge)
    .where(whereClause);

  const result = await db.select()
    .from(knowledge)
    .where(whereClause)
    .orderBy(desc(knowledge.createdAt))
    .limit(params.limit || 20)
    .offset(params.offset || 0);

  return { items: result, total: countResult.count };
}

export async function updateKnowledge(id: number, data: Partial<InsertKnowledge>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(knowledge).set(data).where(eq(knowledge.id, id));
  return getKnowledgeById(id);
}

export async function deleteKnowledge(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(knowledge).where(eq(knowledge.id, id));
}

export async function incrementKnowledgeView(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(knowledge)
    .set({ viewCount: sql`${knowledge.viewCount} + 1` })
    .where(eq(knowledge.id, id));
}

// ==================== 执行日志相关 ====================
export async function createExecutionLog(data: InsertExecutionLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(executionLogs).values(data).$returningId();
  const [log] = await db.select().from(executionLogs).where(eq(executionLogs.id, result.id));
  return log;
}

export async function getExecutionLogsByTicketId(ticketId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(executionLogs)
    .where(eq(executionLogs.ticketId, ticketId))
    .orderBy(executionLogs.createdAt);
}

// ==================== 统计相关 ====================
export async function getTicketStats(params: { startDate?: Date; endDate?: Date } = {}) {
  const db = await getDb();
  if (!db) return null;

  const conditions = [];
  if (params.startDate) conditions.push(gte(tickets.createdAt, params.startDate));
  if (params.endDate) conditions.push(lte(tickets.createdAt, params.endDate));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await db.select({ count: sql<number>`count(*)` })
    .from(tickets).where(whereClause);

  const [resolvedResult] = await db.select({ count: sql<number>`count(*)` })
    .from(tickets)
    .where(and(whereClause, eq(tickets.status, 'resolved')));

  const [avgResponseResult] = await db.select({ 
    avg: sql<number>`AVG(${tickets.responseTime})` 
  }).from(tickets).where(whereClause);

  const [avgResolveResult] = await db.select({ 
    avg: sql<number>`AVG(${tickets.resolveTime})` 
  }).from(tickets).where(and(whereClause, eq(tickets.status, 'resolved')));

  const categoryStats = await db.select({
    category: tickets.category,
    count: sql<number>`count(*)`
  }).from(tickets).where(whereClause).groupBy(tickets.category);

  const statusStats = await db.select({
    status: tickets.status,
    count: sql<number>`count(*)`
  }).from(tickets).where(whereClause).groupBy(tickets.status);

  return {
    total: totalResult.count,
    resolved: resolvedResult.count,
    resolveRate: totalResult.count > 0 ? (resolvedResult.count / totalResult.count) * 100 : 0,
    avgResponseTime: avgResponseResult.avg || 0,
    avgResolveTime: avgResolveResult.avg || 0,
    byCategory: categoryStats,
    byStatus: statusStats
  };
}

export async function getToolStats() {
  const db = await getDb();
  if (!db) return null;

  const toolList = await db.select().from(tools).orderBy(desc(tools.usageCount));
  
  const totalUsage = toolList.reduce((sum, t) => sum + t.usageCount, 0);
  const avgSuccessRate = toolList.length > 0 
    ? toolList.reduce((sum, t) => sum + (t.successRate || 0), 0) / toolList.length 
    : 0;

  return {
    totalTools: toolList.length,
    totalUsage,
    avgSuccessRate,
    topTools: toolList.slice(0, 10)
  };
}

// ==================== 系统配置相关 ====================
export async function getConfig(key: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [config] = await db.select().from(systemConfig).where(eq(systemConfig.key, key));
  return config?.value;
}

export async function setConfig(key: string, value: string, description?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(systemConfig)
    .values({ key, value, description })
    .onDuplicateKeyUpdate({ set: { value, description } });
}
