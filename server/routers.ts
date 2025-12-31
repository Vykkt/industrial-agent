import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTicket, getTicketById, getTicketByNo, listTickets, updateTicket,
  createMessage, getMessagesByTicketId,
  createTool, getToolById, listTools, updateTool, deleteTool,
  createKnowledge, getKnowledgeById, listKnowledge, updateKnowledge, deleteKnowledge, incrementKnowledgeView,
  getExecutionLogsByTicketId,
  getTicketStats, getToolStats
} from "./db";
import { runAgent, classifyProblem } from "./agent/engine";
import { getToolDefinitions } from "./agent/industrial-tools";
import { getAvailableMCPServers, listMCPTools, callMCPTool, logMCPCall, getMCPCallLogs } from "./mcp";

// 工单路由
const ticketRouter = router({
  // 创建工单
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(256),
      description: z.string().min(1),
      category: z.enum([
        "erp_finance", "erp_inventory", "mes_production", "mes_quality",
        "plm_design", "plm_bom", "scada_alarm", "scada_data",
        "oa_workflow", "iam_permission", "hr_attendance", "other"
      ]).optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      // 自动分类问题
      let category = input.category;
      let priority = input.priority;
      
      if (!category || !priority) {
        const classification = await classifyProblem(input.description);
        category = category || (classification.category as "erp_finance" | "erp_inventory" | "mes_production" | "mes_quality" | "plm_design" | "plm_bom" | "scada_alarm" | "scada_data" | "oa_workflow" | "iam_permission" | "hr_attendance" | "other");
        priority = priority || (classification.priority as "low" | "medium" | "high" | "urgent");
      }

      const ticket = await createTicket({
        title: input.title,
        description: input.description,
        category: category || 'other',
        priority: priority || 'medium',
        userId: ctx.user.id,
        status: 'pending'
      });

      // 创建初始用户消息
      await createMessage({
        ticketId: ticket.id,
        role: 'user',
        content: `**问题标题**: ${input.title}\n\n**问题描述**: ${input.description}`
      });

      return ticket;
    }),

  // 获取工单详情
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '工单不存在' });
      }
      return ticket;
    }),

  // 获取工单（通过编号）
  getByNo: protectedProcedure
    .input(z.object({ ticketNo: z.string() }))
    .query(async ({ input }) => {
      const ticket = await getTicketByNo(input.ticketNo);
      if (!ticket) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '工单不存在' });
      }
      return ticket;
    }),

  // 列出工单
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["pending", "processing", "waiting_feedback", "resolved", "closed", "failed"]).optional(),
      category: z.enum([
        "erp_finance", "erp_inventory", "mes_production", "mes_quality",
        "plm_design", "plm_bom", "scada_alarm", "scada_data",
        "oa_workflow", "iam_permission", "hr_attendance", "other"
      ]).optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      myTickets: z.boolean().optional(),
      limit: z.number().min(1).max(100).optional(),
      offset: z.number().min(0).optional()
    }).optional())
    .query(async ({ ctx, input }) => {
      return listTickets({
        userId: input?.myTickets ? ctx.user.id : undefined,
        status: input?.status,
        category: input?.category,
        priority: input?.priority,
        limit: input?.limit,
        offset: input?.offset
      });
    }),

  // 更新工单状态
  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["pending", "processing", "waiting_feedback", "resolved", "closed", "failed"]),
      resolution: z.string().optional(),
      satisfaction: z.number().min(1).max(5).optional()
    }))
    .mutation(async ({ input }) => {
      const updateData: Record<string, unknown> = { status: input.status };
      if (input.resolution) updateData.resolution = input.resolution;
      if (input.satisfaction) updateData.satisfaction = input.satisfaction;
      if (input.status === 'resolved') updateData.resolvedAt = new Date();
      
      return updateTicket(input.id, updateData);
    }),

  // 获取工单消息
  getMessages: protectedProcedure
    .input(z.object({ ticketId: z.number() }))
    .query(async ({ input }) => {
      return getMessagesByTicketId(input.ticketId);
    }),

  // 获取执行日志
  getExecutionLogs: protectedProcedure
    .input(z.object({ ticketId: z.number() }))
    .query(async ({ input }) => {
      return getExecutionLogsByTicketId(input.ticketId);
    }),

  // 统计数据
  stats: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional()
    }).optional())
    .query(async ({ input }) => {
      return getTicketStats({
        startDate: input?.startDate ? new Date(input.startDate) : undefined,
        endDate: input?.endDate ? new Date(input.endDate) : undefined
      });
    })
});

// Agent对话路由
const agentRouter = router({
  // 发送消息给Agent
  chat: protectedProcedure
    .input(z.object({
      ticketId: z.number(),
      message: z.string().min(1)
    }))
    .mutation(async ({ ctx, input }) => {
      const ticket = await getTicketById(input.ticketId);
      if (!ticket) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '工单不存在' });
      }

      // 更新工单状态为处理中
      if (ticket.status === 'pending') {
        await updateTicket(input.ticketId, { 
          status: 'processing',
          responseTime: Math.floor((Date.now() - ticket.createdAt.getTime()) / 1000)
        });
      }

      // 创建用户消息
      await createMessage({
        ticketId: input.ticketId,
        role: 'user',
        content: input.message
      });

      // 获取历史消息
      const history = await getMessagesByTicketId(input.ticketId);
      const conversationHistory = history.slice(0, -1).map(m => ({
        role: m.role as 'user' | 'assistant' | 'tool',
        content: m.content
      }));

      // 运行Agent
      const startTime = Date.now();
      const response = await runAgent(input.message, {
        ticketId: input.ticketId,
        userId: ctx.user.id,
        maxIterations: 5
      }, conversationHistory);

      // 保存Agent回复
      const assistantMessage = await createMessage({
        ticketId: input.ticketId,
        role: 'assistant',
        content: response.answer,
        reasoning: response.steps.map(s => s.thought).join('\n')
      });

      // 更新工单信息
      const existingTools = ticket.toolsUsed || [];
      const allTools = Array.from(new Set([...existingTools, ...response.toolsUsed]));
      await updateTicket(input.ticketId, {
        toolsUsed: allTools,
        agentSummary: response.answer.slice(0, 500)
      });

      return {
        message: assistantMessage,
        steps: response.steps,
        toolsUsed: response.toolsUsed,
        totalTime: response.totalTime
      };
    }),

  // 自动处理工单
  autoProcess: protectedProcedure
    .input(z.object({ ticketId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const ticket = await getTicketById(input.ticketId);
      if (!ticket) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '工单不存在' });
      }

      // 更新状态
      await updateTicket(input.ticketId, { 
        status: 'processing',
        responseTime: Math.floor((Date.now() - ticket.createdAt.getTime()) / 1000)
      });

      // 构建问题描述
      const problemDescription = `问题标题: ${ticket.title}\n问题描述: ${ticket.description}\n问题类别: ${ticket.category}\n优先级: ${ticket.priority}`;

      // 运行Agent
      const response = await runAgent(problemDescription, {
        ticketId: input.ticketId,
        userId: ctx.user.id,
        maxIterations: 5
      });

      // 保存Agent回复
      await createMessage({
        ticketId: input.ticketId,
        role: 'assistant',
        content: response.answer,
        reasoning: response.steps.map(s => s.thought).join('\n')
      });

      // 更新工单
      const resolveTime = Math.floor((Date.now() - ticket.createdAt.getTime()) / 1000);
      await updateTicket(input.ticketId, {
        status: response.success ? 'waiting_feedback' : 'failed',
        toolsUsed: response.toolsUsed,
        agentSummary: response.answer.slice(0, 500),
        resolution: response.answer,
        resolveTime
      });

      return {
        success: response.success,
        answer: response.answer,
        steps: response.steps,
        toolsUsed: response.toolsUsed
      };
    })
});

// 工具管理路由
const toolRouter = router({
  // 列出所有工具
  list: protectedProcedure
    .input(z.object({
      category: z.enum(["erp", "mes", "plm", "scada", "oa", "iam", "hr", "knowledge"]).optional(),
      isEnabled: z.boolean().optional()
    }).optional())
    .query(async ({ input }) => {
      return listTools({
        category: input?.category,
        isEnabled: input?.isEnabled
      });
    }),

  // 获取工具详情
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const tool = await getToolById(input.id);
      if (!tool) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '工具不存在' });
      }
      return tool;
    }),

  // 创建工具
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(128),
      displayName: z.string().min(1).max(128),
      description: z.string().min(1),
      category: z.enum(["erp", "mes", "plm", "scada", "oa", "iam", "hr", "knowledge"]),
      parameters: z.array(z.object({
        name: z.string(),
        type: z.string(),
        description: z.string(),
        required: z.boolean(),
        enum: z.array(z.string()).optional()
      })),
      endpoint: z.string().optional()
    }))
    .mutation(async ({ input }) => {
      return createTool(input);
    }),

  // 更新工具
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      displayName: z.string().optional(),
      description: z.string().optional(),
      isEnabled: z.boolean().optional(),
      parameters: z.array(z.object({
        name: z.string(),
        type: z.string(),
        description: z.string(),
        required: z.boolean(),
        enum: z.array(z.string()).optional()
      })).optional()
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return updateTool(id, data);
    }),

  // 删除工具
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteTool(input.id);
      return { success: true };
    }),

  // 初始化预置工具
  initPreset: protectedProcedure
    .mutation(async () => {
      const definitions = getToolDefinitions();
      const results = [];
      
      for (const def of definitions) {
        try {
          const existing = await listTools({ category: def.category });
          const exists = existing.some(t => t.name === def.name);
          
          if (!exists) {
            const tool = await createTool({
              name: def.name,
              displayName: def.displayName,
              description: def.description,
              category: def.category,
              parameters: def.parameters
            });
            results.push({ name: def.name, status: 'created', id: tool.id });
          } else {
            results.push({ name: def.name, status: 'exists' });
          }
        } catch (error) {
          results.push({ name: def.name, status: 'error', error: String(error) });
        }
      }
      
      return { results, total: definitions.length };
    }),

  // 工具统计
  stats: protectedProcedure.query(async () => {
    return getToolStats();
  })
});

// MCP路由
const mcpRouter = router({
  // 获取可用的MCP服务器
  servers: protectedProcedure.query(async () => {
    return getAvailableMCPServers();
  }),

  // 列出MCP服务器的工具
  listTools: protectedProcedure
    .input(z.object({ server: z.string() }))
    .query(async ({ input }) => {
      return listMCPTools(input.server);
    }),

  // 调用MCP工具
  callTool: protectedProcedure
    .input(z.object({
      server: z.string(),
      tool: z.string(),
      params: z.record(z.string(), z.any())
    }))
    .mutation(async ({ input }) => {
      const startTime = Date.now();
      const result = await callMCPTool(input.server, input.tool, input.params);
      const duration = Date.now() - startTime;
      
      // 记录调用日志
      logMCPCall({
        server: input.server,
        tool: input.tool,
        params: input.params,
        result: result.content,
        success: result.success,
        duration
      });
      
      return result;
    }),

  // 获取MCP调用日志
  logs: protectedProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(async ({ input }) => {
      return getMCPCallLogs(input?.limit);
    })
});

// 知识库路由
const knowledgeRouter = router({
  // 列出知识
  list: protectedProcedure
    .input(z.object({
      category: z.enum([
        "equipment_manual", "fault_case", "process_spec",
        "operation_guide", "troubleshooting", "best_practice"
      ]).optional(),
      systemType: z.enum(["erp", "mes", "plm", "scada", "oa", "iam", "hr", "general"]).optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(100).optional(),
      offset: z.number().min(0).optional()
    }).optional())
    .query(async ({ input }) => {
      return listKnowledge({
        category: input?.category,
        systemType: input?.systemType,
        search: input?.search,
        limit: input?.limit,
        offset: input?.offset
      });
    }),

  // 获取知识详情
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const doc = await getKnowledgeById(input.id);
      if (!doc) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '文档不存在' });
      }
      await incrementKnowledgeView(input.id);
      return doc;
    }),

  // 创建知识
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(256),
      content: z.string().min(1),
      category: z.enum([
        "equipment_manual", "fault_case", "process_spec",
        "operation_guide", "troubleshooting", "best_practice"
      ]),
      systemType: z.enum(["erp", "mes", "plm", "scada", "oa", "iam", "hr", "general"]).optional(),
      tags: z.array(z.string()).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      return createKnowledge({
        ...input,
        systemType: input.systemType || 'general',
        createdBy: ctx.user.id
      });
    }),

  // 更新知识
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      content: z.string().optional(),
      category: z.enum([
        "equipment_manual", "fault_case", "process_spec",
        "operation_guide", "troubleshooting", "best_practice"
      ]).optional(),
      systemType: z.enum(["erp", "mes", "plm", "scada", "oa", "iam", "hr", "general"]).optional(),
      tags: z.array(z.string()).optional()
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return updateKnowledge(id, data);
    }),

  // 删除知识
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteKnowledge(input.id);
      return { success: true };
    })
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  ticket: ticketRouter,
  agent: agentRouter,
  tool: toolRouter,
  knowledge: knowledgeRouter,
  mcp: mcpRouter
});

export type AppRouter = typeof appRouter;
