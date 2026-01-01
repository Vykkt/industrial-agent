/**
 * 自主编排引擎
 * Agent自动选择最佳执行方式（API/MCP/RPA/Skills）处理问题
 */

import { invokeLLM } from '../_core/llm';
import { BaseAPIConnector, APIConnectorRegistry } from '../api-connectors/base';
import { listMCPTools, callMCPTool, getAvailableMCPServers, MCPTool } from '../mcp/client';
import ComputerUseAgent, { ComputerUseTask, ComputerUseResult } from '../computer-use';
import { loadSkills, getWorkflow, getScenario, Workflow, Scenario, WorkflowStep } from '../../skills';

// 执行方式类型
export type ExecutionMethod = 'api' | 'mcp' | 'rpa' | 'skill' | 'hybrid';

// 问题分析结果
export interface ProblemAnalysis {
  category: string;
  subcategory: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedSystems: string[];
  requiredActions: string[];
  suggestedMethod: ExecutionMethod;
  confidence: number;
  reasoning: string;
}

// 执行计划
export interface ExecutionPlan {
  id: string;
  problemId: string;
  method: ExecutionMethod;
  steps: ExecutionStep[];
  estimatedDuration: number;
  riskLevel: 'low' | 'medium' | 'high';
  rollbackPlan?: string;
  approvalRequired: boolean;
}

// 执行步骤
export interface ExecutionStep {
  id: string;
  order: number;
  method: ExecutionMethod;
  action: string;
  target: string;
  parameters: Record<string, unknown>;
  expectedResult: string;
  timeout: number;
  retryCount: number;
  fallbackMethod?: ExecutionMethod;
}

// 执行结果
export interface ExecutionResult {
  planId: string;
  success: boolean;
  completedSteps: number;
  totalSteps: number;
  results: StepResult[];
  duration: number;
  error?: string;
  suggestions?: string[];
}

// 步骤执行结果
export interface StepResult {
  stepId: string;
  success: boolean;
  method: ExecutionMethod;
  output?: unknown;
  error?: string;
  duration: number;
  retries: number;
}

// 可用资源
interface AvailableResources {
  apis: { name: string; endpoints: string[] }[];
  mcpServers: { name: string; tools: string[] }[];
  skills: { workflows: string[]; scenarios: string[] };
  rpaTemplates: string[];
}

/**
 * 自主编排引擎
 */
export class OrchestrationEngine {
  private apiRegistry: typeof APIConnectorRegistry;
  // MCP functions imported directly
  private computerUseAgent: ComputerUseAgent;
  private skillsLoaded: boolean = false;

  constructor() {
    this.apiRegistry = APIConnectorRegistry;
    // MCP functions imported directly
    this.computerUseAgent = new ComputerUseAgent();
    // Skills will be loaded on demand
  }

  /**
   * 分析问题
   */
  async analyzeProblem(problemDescription: string): Promise<ProblemAnalysis> {
    const resources = await this.getAvailableResources();
    
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `你是一个工业智能运维专家，负责分析问题并确定最佳解决方案。

可用资源：
${JSON.stringify(resources, null, 2)}

请分析问题并返回JSON格式的分析结果：
{
  "category": "问题类别（如：设备故障、系统异常、数据问题、流程阻塞等）",
  "subcategory": "子类别",
  "severity": "严重程度（low/medium/high/critical）",
  "affectedSystems": ["受影响的系统列表"],
  "requiredActions": ["需要执行的动作列表"],
  "suggestedMethod": "建议的执行方式（api/mcp/rpa/skill/hybrid）",
  "confidence": 0.85,
  "reasoning": "选择该方式的原因"
}

执行方式选择原则：
1. API：目标系统有开放API，且操作可通过API完成
2. MCP：已配置MCP服务器，且有对应工具
3. RPA：需要操作GUI界面，无API可用
4. Skill：有预定义的工作流或场景匹配
5. Hybrid：需要组合多种方式`
        },
        {
          role: 'user',
          content: problemDescription,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'problem_analysis',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              category: { type: 'string' },
              subcategory: { type: 'string' },
              severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
              affectedSystems: { type: 'array', items: { type: 'string' } },
              requiredActions: { type: 'array', items: { type: 'string' } },
              suggestedMethod: { type: 'string', enum: ['api', 'mcp', 'rpa', 'skill', 'hybrid'] },
              confidence: { type: 'number' },
              reasoning: { type: 'string' },
            },
            required: ['category', 'subcategory', 'severity', 'affectedSystems', 'requiredActions', 'suggestedMethod', 'confidence', 'reasoning'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      throw new Error('无法分析问题');
    }
    
    return JSON.parse(content);
  }

  /**
   * 生成执行计划
   */
  async generatePlan(
    problemId: string,
    analysis: ProblemAnalysis,
    problemDescription: string
  ): Promise<ExecutionPlan> {
    const resources = await this.getAvailableResources();
    
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `你是一个工业智能运维专家，负责生成问题解决的执行计划。

问题分析结果：
${JSON.stringify(analysis, null, 2)}

可用资源：
${JSON.stringify(resources, null, 2)}

请生成详细的执行计划，返回JSON格式：
{
  "method": "主要执行方式",
  "steps": [
    {
      "id": "step_1",
      "order": 1,
      "method": "api",
      "action": "查询设备状态",
      "target": "MES系统",
      "parameters": { "deviceId": "xxx" },
      "expectedResult": "获取设备当前状态",
      "timeout": 30,
      "retryCount": 3,
      "fallbackMethod": "rpa"
    }
  ],
  "estimatedDuration": 300,
  "riskLevel": "medium",
  "rollbackPlan": "如果失败，回滚步骤说明",
  "approvalRequired": false
}

注意：
1. 步骤要具体可执行
2. 每个步骤指定明确的目标系统和参数
3. 设置合理的超时和重试
4. 高风险操作需要审批`
        },
        {
          role: 'user',
          content: problemDescription,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'execution_plan',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              method: { type: 'string', enum: ['api', 'mcp', 'rpa', 'skill', 'hybrid'] },
              steps: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    order: { type: 'number' },
                    method: { type: 'string', enum: ['api', 'mcp', 'rpa', 'skill'] },
                    action: { type: 'string' },
                    target: { type: 'string' },
                    parameters: { type: 'object', additionalProperties: true },
                    expectedResult: { type: 'string' },
                    timeout: { type: 'number' },
                    retryCount: { type: 'number' },
                    fallbackMethod: { type: 'string' },
                  },
                  required: ['id', 'order', 'method', 'action', 'target', 'parameters', 'expectedResult', 'timeout', 'retryCount'],
                  additionalProperties: false,
                },
              },
              estimatedDuration: { type: 'number' },
              riskLevel: { type: 'string', enum: ['low', 'medium', 'high'] },
              rollbackPlan: { type: 'string' },
              approvalRequired: { type: 'boolean' },
            },
            required: ['method', 'steps', 'estimatedDuration', 'riskLevel', 'approvalRequired'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      throw new Error('无法生成执行计划');
    }
    
    const plan = JSON.parse(content);
    return {
      id: `plan_${Date.now()}`,
      problemId,
      ...plan,
    };
  }

  /**
   * 执行计划
   */
  async executePlan(plan: ExecutionPlan): Promise<ExecutionResult> {
    const startTime = Date.now();
    const results: StepResult[] = [];
    let success = true;

    for (const step of plan.steps.sort((a, b) => a.order - b.order)) {
      const stepResult = await this.executeStep(step);
      results.push(stepResult);

      if (!stepResult.success) {
        // 尝试回退方法
        if (step.fallbackMethod) {
          const fallbackStep = { ...step, method: step.fallbackMethod as ExecutionMethod };
          const fallbackResult = await this.executeStep(fallbackStep);
          results.push(fallbackResult);
          
          if (!fallbackResult.success) {
            success = false;
            break;
          }
        } else {
          success = false;
          break;
        }
      }
    }

    return {
      planId: plan.id,
      success,
      completedSteps: results.filter(r => r.success).length,
      totalSteps: plan.steps.length,
      results,
      duration: Date.now() - startTime,
    };
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(step: ExecutionStep): Promise<StepResult> {
    const startTime = Date.now();
    let retries = 0;
    let lastError: string | undefined;

    while (retries <= step.retryCount) {
      try {
        const output = await this.executeByMethod(step);
        return {
          stepId: step.id,
          success: true,
          method: step.method,
          output,
          duration: Date.now() - startTime,
          retries,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        retries++;
        
        if (retries <= step.retryCount) {
          await this.wait(1000 * retries); // 指数退避
        }
      }
    }

    return {
      stepId: step.id,
      success: false,
      method: step.method,
      error: lastError,
      duration: Date.now() - startTime,
      retries,
    };
  }

  /**
   * 根据方法执行
   */
  private async executeByMethod(step: ExecutionStep): Promise<unknown> {
    switch (step.method) {
      case 'api':
        return this.executeAPI(step);
      case 'mcp':
        return this.executeMCP(step);
      case 'rpa':
        return this.executeRPA(step);
      case 'skill':
        return this.executeSkill(step);
      default:
        throw new Error(`不支持的执行方式: ${step.method}`);
    }
  }

  /**
   * 执行API调用
   */
  private async executeAPI(step: ExecutionStep): Promise<unknown> {
    const connector = this.apiRegistry.get(step.target);
    if (!connector) {
      throw new Error(`未找到API连接器: ${step.target}`);
    }

    const { endpoint, method, data, params } = step.parameters as {
      endpoint: string;
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      data?: unknown;
      params?: Record<string, unknown>;
    };

    const result = await connector.call(endpoint, method || 'GET', data, params);
    if (!result.success) {
      throw new Error(result.error || 'API调用失败');
    }

    return result.data;
  }

  /**
   * 执行MCP工具调用
   */
  private async executeMCP(step: ExecutionStep): Promise<unknown> {
    const servers = getAvailableMCPServers();
    const server = servers.find(s => s.name === step.target);
    if (!server) {
      throw new Error(`未找到MCP服务器: ${step.target}`);
    }

    const { toolName, args } = step.parameters as {
      toolName: string;
      args: Record<string, unknown>;
    };

    const result = await callMCPTool(step.target, toolName, args);
    if (!result.success) {
      throw new Error(result.error || 'MCP工具调用失败');
    }
    return result.content;
  }

  /**
   * 执行RPA操作
   */
  private async executeRPA(step: ExecutionStep): Promise<unknown> {
    const task: ComputerUseTask = {
      id: step.id,
      name: step.action,
      description: step.expectedResult,
      instructions: step.action,
      targetApplication: step.target,
      inputs: step.parameters as Record<string, string>,
      timeout: step.timeout * 1000,
    };

    const result = await this.computerUseAgent.executeTask(task);
    if (!result.success) {
      throw new Error(result.error || 'RPA执行失败');
    }

    return result.extractedData;
  }

  /**
   * 执行Skill工作流
   */
  private async executeSkill(step: ExecutionStep): Promise<unknown> {
    const { workflowId, inputs } = step.parameters as {
      workflowId: string;
      inputs: Record<string, unknown>;
    };

    const workflow = getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`未找到工作流: ${workflowId}`);
    }

    // 执行工作流中的每个步骤
    const results: unknown[] = [];
    for (const workflowStep of workflow.steps) {
      const stepResult = await this.executeWorkflowStep(workflowStep, inputs);
      results.push(stepResult);
    }

    return results;
  }

  /**
   * 执行工作流步骤
   */
  private async executeWorkflowStep(
    workflowStep: WorkflowStep,
    inputs: Record<string, unknown>
  ): Promise<unknown> {
    // 根据工作流步骤类型执行
    const toolName = workflowStep.tool || '';
    const step: ExecutionStep = {
      id: workflowStep.id,
      order: 0,
      method: toolName.startsWith('api_') ? 'api' : 
              toolName.startsWith('mcp_') ? 'mcp' : 
              toolName.startsWith('rpa_') ? 'rpa' : 'api',
      action: workflowStep.name,
      target: toolName.replace(/^(api_|mcp_|rpa_)/, ''),
      parameters: { ...workflowStep.params, ...inputs },
      expectedResult: workflowStep.description || '',
      timeout: 30,
      retryCount: 3,
    };

    return this.executeByMethod(step);
  }

  /**
   * 获取可用资源
   */
  private async getAvailableResources(): Promise<AvailableResources> {
    const apis = this.apiRegistry.list().map(name => {
      const connector = this.apiRegistry.get(name);
      return {
        name,
        endpoints: connector?.getEndpoints().map(e => e.name) || [],
      };
    });

    const mcpServerList = getAvailableMCPServers();
    const mcpServers = await Promise.all(
      mcpServerList.map(async (server) => {
        const tools = await listMCPTools(server.name);
        return {
          name: server.name,
          tools: tools.map(t => t.name),
        };
      })
    );

    const skills = {
      workflows: [], // Will be populated from skills config
      scenarios: [], // Will be populated from skills config
    };

    const rpaTemplates = [
      'kingdee_login', 'kingdee_query_voucher', 'kingdee_create_po',
      'mes_report_production', 'mes_check_equipment',
      'scada_ack_alarm', 'scada_export_data',
      'oa_submit_approval', 'oa_check_tasks',
    ];

    return { apis, mcpServers, skills, rpaTemplates };
  }

  /**
   * 等待
   */
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 智能处理问题（一站式入口）
   */
  async handleProblem(problemDescription: string): Promise<{
    analysis: ProblemAnalysis;
    plan: ExecutionPlan;
    result: ExecutionResult;
  }> {
    // 1. 分析问题
    const analysis = await this.analyzeProblem(problemDescription);
    
    // 2. 生成执行计划
    const plan = await this.generatePlan(
      `problem_${Date.now()}`,
      analysis,
      problemDescription
    );
    
    // 3. 检查是否需要审批
    if (plan.approvalRequired) {
      throw new Error('该操作需要人工审批，请联系管理员');
    }
    
    // 4. 执行计划
    const result = await this.executePlan(plan);
    
    return { analysis, plan, result };
  }
}

export default OrchestrationEngine;
