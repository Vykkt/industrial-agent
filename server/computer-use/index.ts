/**
 * Computer Use 模块
 * 实现模拟人操作Windows电脑的RPA功能
 * 支持GUI自动化、屏幕识别、鼠标键盘操作
 */

import { invokeLLM } from '../_core/llm';

// Computer Use 动作类型
export type ComputerAction = 
  | { type: 'click'; x: number; y: number; button?: 'left' | 'right' | 'middle' }
  | { type: 'double_click'; x: number; y: number }
  | { type: 'type'; text: string }
  | { type: 'key'; key: string; modifiers?: string[] }
  | { type: 'scroll'; x: number; y: number; direction: 'up' | 'down' | 'left' | 'right'; amount?: number }
  | { type: 'move'; x: number; y: number }
  | { type: 'drag'; startX: number; startY: number; endX: number; endY: number }
  | { type: 'screenshot' }
  | { type: 'wait'; duration: number }
  | { type: 'find_element'; description: string }
  | { type: 'read_screen'; region?: { x: number; y: number; width: number; height: number } };

// Computer Use 任务定义
export interface ComputerUseTask {
  id: string;
  name: string;
  description: string;
  instructions: string;
  targetApplication?: string;
  inputs?: Record<string, string>;
  timeout?: number;
  requiresAuth?: boolean;
  credentials?: {
    type: 'website' | 'desktop';
    username?: string;
    password?: string;
  };
}

// Computer Use 执行结果
export interface ComputerUseResult {
  success: boolean;
  taskId: string;
  actions: ComputerAction[];
  screenshots: string[];
  extractedData?: Record<string, unknown>;
  error?: string;
  duration: number;
}

// 屏幕元素
export interface ScreenElement {
  id: string;
  type: 'button' | 'input' | 'text' | 'link' | 'image' | 'dropdown' | 'checkbox' | 'radio' | 'unknown';
  text?: string;
  bounds: { x: number; y: number; width: number; height: number };
  interactable: boolean;
  confidence: number;
}

/**
 * Computer Use Agent
 * 使用LLM进行GUI理解和操作规划
 */
export class ComputerUseAgent {
  private maxSteps: number;
  private screenshotHistory: string[] = [];

  constructor(options?: { maxSteps?: number }) {
    this.maxSteps = options?.maxSteps || 50;
  }

  /**
   * 执行Computer Use任务
   */
  async executeTask(task: ComputerUseTask): Promise<ComputerUseResult> {
    const startTime = Date.now();
    const actions: ComputerAction[] = [];
    const screenshots: string[] = [];
    let extractedData: Record<string, unknown> = {};

    try {
      // 1. 分析任务，生成执行计划
      const plan = await this.planTask(task);
      
      // 2. 逐步执行计划
      for (let step = 0; step < this.maxSteps; step++) {
        // 获取当前屏幕状态
        const screenshot = await this.captureScreen();
        screenshots.push(screenshot);
        this.screenshotHistory.push(screenshot);

        // 分析屏幕，决定下一步动作
        const nextAction = await this.decideNextAction(
          task,
          plan,
          screenshot,
          actions,
          step
        );

        if (!nextAction) {
          // 任务完成
          break;
        }

        // 执行动作
        await this.executeAction(nextAction);
        actions.push(nextAction);

        // 检查是否需要提取数据
        if (nextAction.type === 'read_screen') {
          const data = await this.extractDataFromScreen(screenshot, task);
          extractedData = { ...extractedData, ...data };
        }

        // 等待UI响应
        await this.wait(500);
      }

      return {
        success: true,
        taskId: task.id,
        actions,
        screenshots,
        extractedData,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        taskId: task.id,
        actions,
        screenshots,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 规划任务执行步骤
   */
  private async planTask(task: ComputerUseTask): Promise<string[]> {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `你是一个Computer Use专家，负责将用户任务分解为具体的GUI操作步骤。
请分析任务并生成详细的执行计划。

任务信息：
- 名称：${task.name}
- 描述：${task.description}
- 目标应用：${task.targetApplication || '未指定'}
- 输入参数：${JSON.stringify(task.inputs || {})}

请返回JSON格式的步骤列表：
{
  "steps": [
    "步骤1描述",
    "步骤2描述",
    ...
  ]
}`
        },
        {
          role: 'user',
          content: task.instructions,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'task_plan',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              steps: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            required: ['steps'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== 'string') return [];
    
    const plan = JSON.parse(content);
    return plan.steps || [];
  }

  /**
   * 决定下一步动作
   */
  private async decideNextAction(
    task: ComputerUseTask,
    plan: string[],
    screenshot: string,
    previousActions: ComputerAction[],
    currentStep: number
  ): Promise<ComputerAction | null> {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `你是一个Computer Use Agent，负责分析屏幕截图并决定下一步操作。

任务：${task.description}
执行计划：${JSON.stringify(plan)}
当前步骤：${currentStep + 1}
已执行动作：${JSON.stringify(previousActions.slice(-5))}

请分析当前屏幕状态，决定下一步操作。如果任务已完成，返回null。

可用动作类型：
- click: 点击指定坐标
- double_click: 双击指定坐标
- type: 输入文本
- key: 按键（如Enter、Tab、Escape等）
- scroll: 滚动
- move: 移动鼠标
- drag: 拖拽
- screenshot: 截图
- wait: 等待
- find_element: 查找元素
- read_screen: 读取屏幕内容

返回JSON格式：
{
  "completed": false,
  "action": {
    "type": "click",
    "x": 100,
    "y": 200
  },
  "reasoning": "点击登录按钮"
}

如果任务完成：
{
  "completed": true,
  "action": null,
  "reasoning": "任务已完成"
}`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `请分析当前屏幕并决定下一步操作。输入参数：${JSON.stringify(task.inputs || {})}`
            },
            {
              type: 'image_url',
              image_url: {
                url: screenshot,
                detail: 'high'
              }
            }
          ]
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== 'string') return null;

    try {
      const decision = JSON.parse(content);
      if (decision.completed) {
        return null;
      }
      return decision.action;
    } catch {
      return null;
    }
  }

  /**
   * 执行动作（模拟实现，实际需要连接到RPA引擎）
   */
  private async executeAction(action: ComputerAction): Promise<void> {
    console.log(`[ComputerUse] 执行动作: ${JSON.stringify(action)}`);
    
    // 这里是模拟实现，实际部署时需要连接到：
    // 1. Windows RPA引擎（如UiPath、Power Automate）
    // 2. 或使用pyautogui等Python库
    // 3. 或使用Playwright/Puppeteer进行浏览器自动化
    
    switch (action.type) {
      case 'click':
        // 模拟点击
        console.log(`点击坐标 (${action.x}, ${action.y})`);
        break;
      case 'type':
        // 模拟输入
        console.log(`输入文本: ${action.text}`);
        break;
      case 'key':
        // 模拟按键
        console.log(`按键: ${action.key}`);
        break;
      case 'wait':
        await this.wait(action.duration);
        break;
      default:
        console.log(`执行动作: ${action.type}`);
    }
  }

  /**
   * 捕获屏幕（模拟实现）
   */
  private async captureScreen(): Promise<string> {
    // 实际实现需要：
    // 1. 调用系统截图API
    // 2. 或通过RPA引擎获取屏幕
    // 3. 返回base64编码的图片或URL
    
    return 'data:image/png;base64,SCREENSHOT_PLACEHOLDER';
  }

  /**
   * 从屏幕提取数据
   */
  private async extractDataFromScreen(
    screenshot: string,
    task: ComputerUseTask
  ): Promise<Record<string, unknown>> {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `你是一个数据提取专家。请从屏幕截图中提取与任务相关的数据。
任务：${task.description}
请返回JSON格式的提取数据。`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '请从当前屏幕提取相关数据'
            },
            {
              type: 'image_url',
              image_url: {
                url: screenshot,
                detail: 'high'
              }
            }
          ]
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== 'string') return {};

    try {
      return JSON.parse(content);
    } catch {
      return { rawText: content };
    }
  }

  /**
   * 等待
   */
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 分析屏幕元素
   */
  async analyzeScreen(screenshot: string): Promise<ScreenElement[]> {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `你是一个GUI分析专家。请分析屏幕截图，识别所有可交互的UI元素。

返回JSON格式：
{
  "elements": [
    {
      "id": "element_1",
      "type": "button",
      "text": "登录",
      "bounds": { "x": 100, "y": 200, "width": 80, "height": 30 },
      "interactable": true,
      "confidence": 0.95
    }
  ]
}`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '请分析屏幕中的UI元素'
            },
            {
              type: 'image_url',
              image_url: {
                url: screenshot,
                detail: 'high'
              }
            }
          ]
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== 'string') return [];

    try {
      const result = JSON.parse(content);
      return result.elements || [];
    } catch {
      return [];
    }
  }
}

/**
 * Computer Use 任务模板
 * 预定义的常见工业软件操作任务
 */
export const ComputerUseTemplates = {
  // 金蝶ERP操作
  kingdee: {
    login: {
      id: 'kingdee_login',
      name: '金蝶云星空登录',
      description: '登录金蝶云星空系统',
      instructions: '打开金蝶云星空，输入用户名和密码，点击登录按钮',
      targetApplication: '金蝶云星空',
      requiresAuth: true,
    },
    queryVoucher: {
      id: 'kingdee_query_voucher',
      name: '查询凭证',
      description: '在金蝶云星空中查询凭证',
      instructions: '进入财务模块，打开凭证查询，设置查询条件，执行查询',
      targetApplication: '金蝶云星空',
    },
    createPurchaseOrder: {
      id: 'kingdee_create_po',
      name: '创建采购订单',
      description: '在金蝶云星空中创建采购订单',
      instructions: '进入采购模块，新建采购订单，填写供应商、物料、数量等信息，保存并提交',
      targetApplication: '金蝶云星空',
    },
  },

  // MES操作
  mes: {
    reportProduction: {
      id: 'mes_report_production',
      name: '生产报工',
      description: '在MES系统中进行生产报工',
      instructions: '打开MES系统，进入生产报工界面，选择工单，填写完工数量，提交报工',
      targetApplication: 'MES系统',
    },
    checkEquipmentStatus: {
      id: 'mes_check_equipment',
      name: '检查设备状态',
      description: '在MES系统中检查设备运行状态',
      instructions: '打开MES系统，进入设备监控界面，查看设备运行状态和参数',
      targetApplication: 'MES系统',
    },
  },

  // SCADA操作
  scada: {
    acknowledgeAlarm: {
      id: 'scada_ack_alarm',
      name: '确认报警',
      description: '在SCADA系统中确认报警',
      instructions: '打开SCADA系统，进入报警列表，选择待确认的报警，点击确认按钮',
      targetApplication: 'SCADA系统',
    },
    exportData: {
      id: 'scada_export_data',
      name: '导出数据',
      description: '从SCADA系统导出历史数据',
      instructions: '打开SCADA系统，进入历史数据查询，设置时间范围和参数，导出为Excel',
      targetApplication: 'SCADA系统',
    },
  },

  // OA操作
  oa: {
    submitApproval: {
      id: 'oa_submit_approval',
      name: '提交审批',
      description: '在OA系统中提交审批申请',
      instructions: '打开OA系统，进入审批中心，新建审批单，填写内容，选择审批人，提交',
      targetApplication: 'OA系统',
    },
    checkPendingTasks: {
      id: 'oa_check_tasks',
      name: '查看待办任务',
      description: '在OA系统中查看待办任务',
      instructions: '打开OA系统，进入待办中心，查看所有待处理的任务',
      targetApplication: 'OA系统',
    },
  },
};

export default ComputerUseAgent;
