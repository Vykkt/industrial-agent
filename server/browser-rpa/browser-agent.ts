/**
 * 浏览器RPA Agent
 * 基于LLM驱动的浏览器自动化
 * 参考OpenManus和browser-use的实现
 */

import { 
  BrowserController, 
  BrowserState, 
  BrowserAction, 
  ActionResult,
  browserController 
} from './browser-controller';
import { MultiModelLLMClient, createLLMClient, ModelConfig } from '../llm';

// Agent配置
export interface BrowserAgentConfig {
  llmConfig: ModelConfig;
  maxSteps?: number;
  timeout?: number;
  verbose?: boolean;
}

// Agent状态
export interface AgentState {
  task: string;
  currentStep: number;
  maxSteps: number;
  previousSteps: StepRecord[];
  browserState: BrowserState;
  status: 'running' | 'completed' | 'failed' | 'timeout';
  result?: string;
  error?: string;
}

// 步骤记录
export interface StepRecord {
  step: number;
  thought: string;
  action: BrowserAction;
  result: ActionResult;
  timestamp: number;
}

// LLM决策结果
interface LLMDecision {
  current_state: {
    evaluation_previous_goal: 'Success' | 'Failed' | 'Unknown';
    memory: string;
    next_goal: string;
  };
  action: BrowserAction;
  is_done?: boolean;
  final_result?: string;
}

// 系统提示词
const SYSTEM_PROMPT = `你是一个专门用于自动化浏览器任务的AI Agent。你的目标是按照以下说明完成最终任务。

## 输入格式
你将收到以下信息：
- Task: 需要完成的最终任务描述
- Previous steps: 已经完成的步骤
- Current URL: 当前浏览器页面的URL
- Interactive Elements: 当前页面上所有可交互的元素，格式为 [index]<tag>text</tag>

## 响应格式
你必须以有效的JSON格式响应，包含以下字段：

{
  "current_state": {
    "evaluation_previous_goal": "Success" | "Failed" | "Unknown",
    "memory": "已完成的工作和需要记住的信息",
    "next_goal": "下一个即时目标"
  },
  "action": {
    "type": "动作类型",
    "params": { "参数": "值" }
  },
  "is_done": false,
  "final_result": null
}

## 支持的动作
- goto: 导航到URL { "url": "https://..." }
- click: 点击元素 { "index": 数字 } 或 { "selector": "CSS选择器" }
- type: 输入文本 { "index": 数字, "text": "要输入的文本" }
- scroll: 滚动页面 { "direction": "up" | "down", "amount": 像素数 }
- select: 选择下拉选项 { "index": 数字, "value": "选项值" }
- hover: 悬停在元素上 { "index": 数字 }
- wait: 等待 { "ms": 毫秒数 }
- extract: 提取数据 { "script": "JavaScript代码" }
- back: 返回上一页 {}
- forward: 前进 {}
- refresh: 刷新页面 {}

## 重要规则
1. 每次只执行一个动作
2. 使用元素的index来精确定位要操作的元素
3. 如果任务完成，设置 is_done: true 并在 final_result 中提供结果
4. 如果遇到错误，尝试其他方法或报告失败
5. 保持memory简洁但信息丰富
`;

/**
 * 浏览器RPA Agent类
 */
export class BrowserAgent {
  private config: BrowserAgentConfig;
  private llmClient: MultiModelLLMClient;
  private controller: BrowserController;
  private state: AgentState | null = null;

  constructor(config: BrowserAgentConfig) {
    this.config = {
      maxSteps: 20,
      timeout: 300000, // 5分钟
      verbose: false,
      ...config,
    };
    this.llmClient = createLLMClient(config.llmConfig);
    this.controller = browserController;
  }

  /**
   * 运行任务
   */
  async run(task: string): Promise<AgentState> {
    // 初始化浏览器
    await this.controller.initialize({ headless: true });

    // 初始化状态
    this.state = {
      task,
      currentStep: 0,
      maxSteps: this.config.maxSteps!,
      previousSteps: [],
      browserState: await this.controller.getState(),
      status: 'running',
    };

    const startTime = Date.now();
    const timeout = this.config.timeout!;

    try {
      while (this.state.status === 'running') {
        // 检查超时
        if (Date.now() - startTime > timeout) {
          this.state.status = 'timeout';
          this.state.error = '任务执行超时';
          break;
        }

        // 检查步骤限制
        if (this.state.currentStep >= this.state.maxSteps) {
          this.state.status = 'failed';
          this.state.error = '达到最大步骤限制';
          break;
        }

        // 执行一步
        await this.executeStep();
      }
    } catch (error) {
      this.state.status = 'failed';
      this.state.error = error instanceof Error ? error.message : String(error);
    } finally {
      // 关闭浏览器
      await this.controller.close();
    }

    return this.state;
  }

  /**
   * 执行单步
   */
  private async executeStep(): Promise<void> {
    if (!this.state) return;

    this.state.currentStep++;

    // 获取当前浏览器状态
    this.state.browserState = await this.controller.getState();

    // 构建LLM输入
    const prompt = this.buildPrompt();

    // 调用LLM获取决策
    const decision = await this.getLLMDecision(prompt);

    if (this.config.verbose) {
      console.log(`Step ${this.state.currentStep}:`, decision);
    }

    // 检查是否完成
    if (decision.is_done) {
      this.state.status = 'completed';
      this.state.result = decision.final_result;
      return;
    }

    // 执行动作
    const result = await this.controller.executeAction(decision.action);

    // 记录步骤
    this.state.previousSteps.push({
      step: this.state.currentStep,
      thought: decision.current_state.next_goal,
      action: decision.action,
      result,
      timestamp: Date.now(),
    });

    // 如果动作失败，可能需要重试或调整策略
    if (!result.success) {
      console.warn(`动作执行失败: ${result.error}`);
    }
  }

  /**
   * 构建LLM提示
   */
  private buildPrompt(): string {
    if (!this.state) return '';

    const stateText = this.controller.formatStateForLLM(this.state.browserState);
    
    let previousStepsText = '';
    if (this.state.previousSteps.length > 0) {
      previousStepsText = this.state.previousSteps.map(s => 
        `Step ${s.step}: ${s.thought}\n  Action: ${s.action.type} ${JSON.stringify(s.action.params)}\n  Result: ${s.result.success ? '成功' : '失败: ' + s.result.error}`
      ).join('\n');
    }

    return `Task: ${this.state.task}

Previous steps:
${previousStepsText || '无'}

${stateText}

请分析当前状态并决定下一步操作。以JSON格式响应。`;
  }

  /**
   * 获取LLM决策
   */
  private async getLLMDecision(prompt: string): Promise<LLMDecision> {
    const response = await this.llmClient.call({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      response_format: {
        type: 'json_object',
      },
    });

    const messageContent = response.choices[0]?.message?.content;
    if (!messageContent) {
      throw new Error('LLM返回空响应');
    }

    const content = typeof messageContent === 'string' 
      ? messageContent 
      : messageContent.map(p => p.type === 'text' ? p.text : '').join('');

    try {
      return JSON.parse(content) as LLMDecision;
    } catch {
      throw new Error(`无法解析LLM响应: ${content}`);
    }
  }

  /**
   * 获取当前状态
   */
  getState(): AgentState | null {
    return this.state;
  }
}

/**
 * 创建浏览器Agent
 */
export function createBrowserAgent(config: BrowserAgentConfig): BrowserAgent {
  return new BrowserAgent(config);
}

/**
 * 快速执行浏览器任务
 */
export async function executeBrowserTask(
  task: string,
  llmConfig: ModelConfig,
  options?: {
    maxSteps?: number;
    timeout?: number;
    verbose?: boolean;
  }
): Promise<AgentState> {
  const agent = createBrowserAgent({
    llmConfig,
    ...options,
  });

  return agent.run(task);
}
