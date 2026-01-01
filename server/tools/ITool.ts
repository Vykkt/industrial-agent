/**
 * 工具接口定义 - 统一的工具执行框架
 * P0改进：支持Mock/Simulation/Real三种执行模式
 */

export interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  enum?: string[];
  default?: any;
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: ToolParameter[];
  returns: {
    type: string;
    description: string;
  };
}

export interface ToolParams {
  [key: string]: any;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    executionTime: number;
    source: string;
    timestamp: Date;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * 工具执行模式
 */
export enum ExecutionMode {
  MOCK = "mock",           // 返回模拟数据
  SIMULATION = "simulation", // 沙箱执行
  REAL = "real",           // 真实执行
  DRY_RUN = "dry_run"      // 模拟执行但不提交
}

/**
 * 工具基础接口
 */
export interface ITool {
  /**
   * 执行工具
   */
  execute(params: ToolParams, mode?: ExecutionMode): Promise<ToolResult>;

  /**
   * 验证工具参数
   */
  validate(params: ToolParams): ValidationResult;

  /**
   * 获取工具Schema
   */
  getSchema(): ToolSchema;

  /**
   * 获取工具名称
   */
  getName(): string;

  /**
   * 获取工具描述
   */
  getDescription(): string;

  /**
   * 获取工具类别
   */
  getCategory(): string;
}

/**
 * 工具执行器接口 - 处理执行前后的逻辑
 */
export interface IToolExecutor {
  /**
   * 执行工具，包括参数验证、权限检查、错误处理、重试等
   */
  execute(
    tool: ITool,
    params: ToolParams,
    mode: ExecutionMode
  ): Promise<ToolResult>;

  /**
   * 获取工具的执行配置
   */
  getExecutionConfig(toolName: string): Promise<any>;

  /**
   * 设置工具的执行配置
   */
  setExecutionConfig(toolName: string, config: any): Promise<void>;
}

/**
 * 工具适配器接口 - 不同执行模式的适配器
 */
export interface IToolAdapter {
  /**
   * 执行工具
   */
  execute(tool: ITool, params: ToolParams): Promise<ToolResult>;

  /**
   * 获取适配器模式
   */
  getMode(): ExecutionMode;
}

/**
 * 工具工厂接口
 */
export interface IToolFactory {
  /**
   * 创建工具实例
   */
  createTool(toolName: string): Promise<ITool | null>;

  /**
   * 注册工具
   */
  registerTool(toolName: string, tool: ITool): void;

  /**
   * 注销工具
   */
  unregisterTool(toolName: string): void;

  /**
   * 获取所有注册的工具
   */
  getRegisteredTools(): string[];

  /**
   * 获取工具
   */
  getTool(toolName: string): ITool | null;
}

/**
 * 工具错误类
 */
export class ToolError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = "ToolError";
  }
}

/**
 * 工具执行错误
 */
export class ToolExecutionError extends ToolError {
  constructor(message: string, details?: any) {
    super("EXECUTION_ERROR", message, details);
    this.name = "ToolExecutionError";
  }
}

/**
 * 工具验证错误
 */
export class ToolValidationError extends ToolError {
  constructor(message: string, details?: any) {
    super("VALIDATION_ERROR", message, details);
    this.name = "ToolValidationError";
  }
}

/**
 * 工具超时错误
 */
export class ToolTimeoutError extends ToolError {
  constructor(message: string, details?: any) {
    super("TIMEOUT_ERROR", message, details);
    this.name = "ToolTimeoutError";
  }
}

/**
 * 工具重试配置
 */
export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

/**
 * 工具执行上下文
 */
export interface ToolExecutionContext {
  toolName: string;
  params: ToolParams;
  mode: ExecutionMode;
  retryCount: number;
  startTime: Date;
  timeout: number;
  userId?: string;
  ticketId?: string;
}
