/**
 * 工业Agent引擎 - 核心推理和工具调用模块
 * 基于ReAct模式实现：Reasoning + Acting
 */

import { invokeLLM } from "../_core/llm";
import { getToolByName, listTools, incrementToolUsage, createExecutionLog } from "../db";
import { Tool } from "../../drizzle/schema";
import { executeIndustrialTool } from "./industrial-tools";

// Agent执行上下文
export interface AgentContext {
  ticketId: number;
  userId: number;
  maxIterations?: number;
  verbose?: boolean;
}

// 工具调用结果
export interface ToolCallResult {
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
  success: boolean;
  executionTime: number;
  error?: string;
}

// Agent执行步骤
export interface AgentStep {
  thought: string;
  action?: string;
  actionInput?: Record<string, unknown>;
  observation?: string;
  toolResult?: ToolCallResult;
}

// Agent最终响应
export interface AgentResponse {
  answer: string;
  steps: AgentStep[];
  toolsUsed: string[];
  totalTime: number;
  success: boolean;
}

/**
 * 将数据库工具转换为LLM工具格式
 */
function toolToLLMFormat(tool: Tool) {
  return {
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object",
        properties: Object.fromEntries(
          tool.parameters.map(p => [
            p.name,
            {
              type: p.type,
              description: p.description,
              ...(p.enum ? { enum: p.enum } : {})
            }
          ])
        ),
        required: tool.parameters.filter(p => p.required).map(p => p.name)
      }
    }
  };
}

/**
 * 构建Agent系统提示词
 */
function buildSystemPrompt(tools: Tool[]): string {
  const toolDescriptions = tools.map(t => 
    `- ${t.name}: ${t.description} [${t.category.toUpperCase()}系统]`
  ).join('\n');

  return `你是一个专业的工业软件智能运维Agent，负责帮助工厂信息科人员解决各类工业系统问题。

## 你的能力
1. 分析用户描述的问题，理解问题本质
2. 选择合适的工具查询相关系统数据
3. 基于查询结果进行推理分析
4. 提供专业的解决方案和操作建议

## 可用工具
${toolDescriptions}

## 工作原则
1. 先理解问题，再选择工具
2. 每次只调用一个工具，等待结果后再决定下一步
3. 如果工具调用失败，尝试其他方法或向用户说明
4. 回答要专业、准确、可操作
5. 涉及敏感操作时，提供详细的操作步骤和注意事项

## 回答格式
- 问题分析：简要说明问题的性质和可能原因
- 查询结果：列出从各系统获取的关键信息
- 解决方案：提供具体的解决步骤
- 注意事项：提醒可能的风险和后续建议`;
}

/**
 * 执行单个工具调用
 */
async function executeToolCall(
  toolName: string,
  input: Record<string, unknown>,
  context: AgentContext
): Promise<ToolCallResult> {
  const startTime = Date.now();
  
  try {
    const tool = await getToolByName(toolName);
    if (!tool) {
      return {
        toolName,
        input,
        output: null,
        success: false,
        executionTime: Date.now() - startTime,
        error: `工具 ${toolName} 不存在`
      };
    }

    if (!tool.isEnabled) {
      return {
        toolName,
        input,
        output: null,
        success: false,
        executionTime: Date.now() - startTime,
        error: `工具 ${toolName} 已被禁用`
      };
    }

    // 执行工业软件工具
    const output = await executeIndustrialTool(toolName, input);
    const executionTime = Date.now() - startTime;

    // 更新工具使用统计
    await incrementToolUsage(tool.id, true, executionTime);

    // 记录执行日志
    await createExecutionLog({
      ticketId: context.ticketId,
      toolId: tool.id,
      toolName,
      input,
      output,
      status: 'success',
      executionTime
    });

    return {
      toolName,
      input,
      output,
      success: true,
      executionTime
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // 记录失败日志
    const tool = await getToolByName(toolName);
    if (tool) {
      await incrementToolUsage(tool.id, false, executionTime);
      await createExecutionLog({
        ticketId: context.ticketId,
        toolId: tool.id,
        toolName,
        input,
        output: null,
        status: 'failed',
        errorMessage,
        executionTime
      });
    }

    return {
      toolName,
      input,
      output: null,
      success: false,
      executionTime,
      error: errorMessage
    };
  }
}

/**
 * Agent主执行函数 - ReAct循环
 */
export async function runAgent(
  userMessage: string,
  context: AgentContext,
  conversationHistory: Array<{ role: 'user' | 'assistant' | 'tool'; content: string }> = []
): Promise<AgentResponse> {
  const startTime = Date.now();
  const maxIterations = context.maxIterations || 5;
  const steps: AgentStep[] = [];
  const toolsUsed: string[] = [];

  // 获取所有启用的工具
  const availableTools = await listTools({ isEnabled: true });
  const llmTools = availableTools.map(toolToLLMFormat);

  // 构建消息历史
  const messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string; tool_calls?: unknown[] }> = [
    { role: 'system', content: buildSystemPrompt(availableTools) },
    ...conversationHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: userMessage }
  ];

  let iteration = 0;
  let finalAnswer = '';

  while (iteration < maxIterations) {
    iteration++;

    try {
      // 调用LLM
      const response = await invokeLLM({
        messages,
        tools: llmTools.length > 0 ? llmTools : undefined,
        tool_choice: llmTools.length > 0 ? 'auto' : undefined
      });

      const assistantMessage = response.choices[0]?.message;
      if (!assistantMessage) {
        throw new Error('LLM返回空响应');
      }

      // 检查是否有工具调用
      const toolCalls = assistantMessage.tool_calls;

      if (toolCalls && toolCalls.length > 0) {
        // 处理工具调用
        for (const toolCall of toolCalls) {
          const toolName = toolCall.function.name;
          let toolInput: Record<string, unknown> = {};
          
          try {
            toolInput = JSON.parse(toolCall.function.arguments || '{}');
          } catch {
            toolInput = {};
          }

          // 记录思考过程
          const step: AgentStep = {
            thought: (typeof assistantMessage.content === 'string' ? assistantMessage.content : '') || `需要调用${toolName}工具获取更多信息`,
            action: toolName,
            actionInput: toolInput
          };

          // 执行工具
          const toolResult = await executeToolCall(toolName, toolInput, context);
          step.toolResult = toolResult;
          step.observation = toolResult.success 
            ? JSON.stringify(toolResult.output, null, 2)
            : `工具调用失败: ${toolResult.error}`;

          steps.push(step);
          
          if (!toolsUsed.includes(toolName)) {
            toolsUsed.push(toolName);
          }

          // 将工具结果添加到消息历史
          messages.push({
            role: 'assistant',
            content: typeof assistantMessage.content === 'string' ? assistantMessage.content : '',
            tool_calls: [toolCall]
          });
          messages.push({
            role: 'tool',
            content: step.observation,
            tool_call_id: toolCall.id
          });
        }
      } else {
        // 没有工具调用，这是最终回答
        finalAnswer = typeof assistantMessage.content === 'string' ? assistantMessage.content : '';
        steps.push({
          thought: '已收集足够信息，生成最终回答',
          observation: finalAnswer
        });
        break;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      steps.push({
        thought: `执行出错: ${errorMessage}`,
        observation: errorMessage
      });
      
      // 尝试生成错误恢复响应
      finalAnswer = `抱歉，在处理您的问题时遇到了技术问题：${errorMessage}。请稍后重试或联系技术支持。`;
      break;
    }
  }

  // 如果达到最大迭代次数仍未完成
  if (!finalAnswer && iteration >= maxIterations) {
    // 请求LLM基于已有信息生成总结
    messages.push({
      role: 'user',
      content: '请基于以上收集到的信息，给出你的分析和建议。'
    });

    try {
      const summaryResponse = await invokeLLM({ messages });
      const summaryContent = summaryResponse.choices[0]?.message?.content;
      finalAnswer = (typeof summaryContent === 'string' ? summaryContent : '') || '无法生成完整回答，请查看上述工具调用结果。';
    } catch {
      finalAnswer = '已达到最大处理步骤，请查看上述工具调用结果进行分析。';
    }
  }

  return {
    answer: finalAnswer,
    steps,
    toolsUsed,
    totalTime: Date.now() - startTime,
    success: true
  };
}

/**
 * 问题分类Agent - 自动识别问题类别
 */
export async function classifyProblem(description: string): Promise<{
  category: string;
  priority: string;
  confidence: number;
  reasoning: string;
}> {
  const prompt = `分析以下工业系统问题，判断其类别和优先级。

问题描述：${description}

请以JSON格式返回：
{
  "category": "问题类别（erp_finance/erp_inventory/mes_production/mes_quality/plm_design/plm_bom/scada_alarm/scada_data/oa_workflow/iam_permission/hr_attendance/other）",
  "priority": "优先级（low/medium/high/urgent）",
  "confidence": 置信度（0-1的小数）,
  "reasoning": "分类理由"
}

分类标准：
- erp_finance: ERP财务相关（成本、费用、账务）
- erp_inventory: ERP库存相关（物料、库存、采购）
- mes_production: MES生产相关（排程、工单、产能）
- mes_quality: MES质量相关（检验、不良、追溯）
- plm_design: PLM设计相关（图纸、设计变更）
- plm_bom: PLM BOM相关（物料清单、配置）
- scada_alarm: SCADA报警相关（设备报警、异常）
- scada_data: SCADA数据相关（采集、监控）
- oa_workflow: OA流程相关（审批、流程）
- iam_permission: IAM权限相关（账号、权限）
- hr_attendance: HR考勤相关（考勤、排班）
- other: 其他问题

优先级标准：
- urgent: 影响生产、紧急故障
- high: 影响业务、需要尽快处理
- medium: 一般问题、可以排队处理
- low: 咨询类、优化建议类`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: '你是一个工业问题分类专家，请准确分析问题类别。' },
        { role: 'user', content: prompt }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'problem_classification',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              category: { type: 'string' },
              priority: { type: 'string' },
              confidence: { type: 'number' },
              reasoning: { type: 'string' }
            },
            required: ['category', 'priority', 'confidence', 'reasoning'],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('Problem classification failed:', error);
  }

  return {
    category: 'other',
    priority: 'medium',
    confidence: 0.5,
    reasoning: '无法自动分类，使用默认值'
  };
}
