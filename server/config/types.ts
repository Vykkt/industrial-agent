/**
 * 配置管理模块 - 类型定义
 * P0改进：支持灵活的系统配置、工具配置、工作流配置
 */

// 系统连接类型
export enum SystemType {
  KINGDEE = "kingdee",
  YONYOU = "yonyou",
  SAP = "sap",
  ORACLE = "oracle",
  CUSTOM = "custom"
}

export enum AuthType {
  BASIC = "basic",
  OAUTH2 = "oauth2",
  API_KEY = "api_key",
  CUSTOM = "custom"
}

export enum ConnectionStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  TESTING = "testing",
  FAILED = "failed"
}

export interface SystemConnectionConfig {
  id?: number;
  systemType: SystemType;
  systemName: string;
  apiEndpoint: string;
  authType: AuthType;
  authConfig: Record<string, any>;
  status?: ConnectionStatus;
  lastTestedAt?: Date;
  testResult?: Record<string, any>;
}

// 工具执行模式
export enum ExecutionMode {
  MOCK = "mock",           // 返回模拟数据
  SIMULATION = "simulation", // 沙箱执行
  REAL = "real",           // 真实执行
  DRY_RUN = "dry_run"      // 模拟执行但不提交
}

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
}

export interface ToolConfig {
  id?: number;
  toolId: number;
  executionMode: ExecutionMode;
  mockData?: Record<string, any>;
  parameters?: Record<string, any>;
  retryConfig?: RetryConfig;
  timeoutMs?: number;
  isEnabled?: boolean;
}

// 工作流步骤类型
export interface WorkflowStep {
  id: string;
  name: string;
  type: string;
  toolId?: number;
  condition?: Record<string, any>;
  timeout?: number;
  retryable?: boolean;
}

export interface WorkflowBranch {
  id: string;
  condition: Record<string, any>;
  targetStepId: string;
}

export interface WorkflowConfig {
  id?: number;
  workflowName: string;
  description?: string;
  steps: WorkflowStep[];
  branches?: WorkflowBranch[];
  version?: number;
  isActive?: boolean;
}

// 工作流执行状态
export enum WorkflowEventType {
  STARTED = "started",
  STEP_EXECUTED = "step_executed",
  STEP_FAILED = "step_failed",
  BRANCH_TAKEN = "branch_taken",
  PAUSED = "paused",
  RESUMED = "resumed",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled"
}

export interface WorkflowEvent {
  id?: number;
  workflowExecutionId: string;
  eventType: WorkflowEventType;
  eventData?: Record<string, any>;
  stepId?: string;
  errorMessage?: string;
  version: number;
}

export interface WorkflowSnapshot {
  id?: number;
  workflowExecutionId: string;
  workflowConfigId: number;
  state: Record<string, any>;
  currentStepId?: string;
  version: number;
}

// 多Agent任务类型
export enum AgentTaskType {
  LEAD = "lead",
  SUB = "sub",
  PARALLEL = "parallel"
}

export enum TaskStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled"
}

export interface MultiAgentTask {
  id?: number;
  taskId: string;
  parentTaskId?: string;
  agentId: string;
  taskType: AgentTaskType;
  objective: string;
  status?: TaskStatus;
  result?: Record<string, any>;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
}

// Agent消息类型
export enum AgentMessageType {
  TASK_ASSIGNMENT = "task_assignment",
  PROGRESS_UPDATE = "progress_update",
  RESULT = "result",
  ERROR_RECOVERY = "error_recovery"
}

export enum MessageStatus {
  PENDING = "pending",
  DELIVERED = "delivered",
  PROCESSED = "processed",
  FAILED = "failed"
}

export interface AgentMessage {
  id?: number;
  messageId: string;
  fromAgentId: string;
  toAgentId: string;
  messageType: AgentMessageType;
  messageData: Record<string, any>;
  status?: MessageStatus;
  retryCount?: number;
}

// 配置验证结果
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

// 配置测试结果
export interface TestResult {
  success: boolean;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
}
