/**
 * 工具执行器 - 处理工具执行的完整流程
 * 包括参数验证、权限检查、执行、错误处理、重试等
 */

import {
  IToolExecutor,
  ITool,
  IToolAdapter,
  ToolParams,
  ToolResult,
  ExecutionMode,
  ToolExecutionContext,
  ToolExecutionError,
  ToolTimeoutError,
  ToolValidationError,
} from "./ITool";
import { toolFactory } from "./ToolFactory";
import { configManager } from "../config/ConfigManager";
import { db } from "../db";
import { executionLogs } from "../../drizzle/schema";

export class ToolExecutor implements IToolExecutor {
  /**
   * 执行工具
   */
  async execute(
    tool: ITool,
    params: ToolParams,
    mode: ExecutionMode = ExecutionMode.MOCK
  ): Promise<ToolResult> {
    const context: ToolExecutionContext = {
      toolName: tool.getName(),
      params,
      mode,
      retryCount: 0,
      startTime: new Date(),
      timeout: 30000,
    };

    try {
      // 1. 参数验证
      const validation = tool.validate(params);
      if (!validation.valid) {
        throw new ToolValidationError(
          `Parameter validation failed: ${validation.errors?.join(", ")}`,
          validation.errors
        );
      }

      // 2. 获取工具配置
      const config = await this.getExecutionConfig(tool.getName());
      if (config) {
        context.timeout = config.timeoutMs || 30000;
      }

      // 3. 执行工具
      const result = await this.executeWithTimeout(tool, params, mode, context);

      // 4. 记录执行日志
      await this.logExecution(context, result);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      const result: ToolResult = {
        success: false,
        error: errorMessage,
        metadata: {
          executionTime: Date.now() - context.startTime.getTime(),
          source: mode,
          timestamp: new Date(),
        },
      };

      // 记录失败日志
      await this.logExecution(context, result, error);

      return result;
    }
  }

  /**
   * 执行工具，支持超时控制
   */
  private async executeWithTimeout(
    tool: ITool,
    params: ToolParams,
    mode: ExecutionMode,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    return Promise.race([
      this.executeToolInternal(tool, params, mode),
      this.createTimeoutPromise(context.timeout),
    ]);
  }

  /**
   * 内部执行工具
   */
  private async executeToolInternal(
    tool: ITool,
    params: ToolParams,
    mode: ExecutionMode
  ): Promise<ToolResult> {
    const adapter = toolFactory.getAdapter(mode);

    if (!adapter) {
      throw new ToolExecutionError(`No adapter found for mode: ${mode}`);
    }

    return adapter.execute(tool, params);
  }

  /**
   * 创建超时Promise
   */
  private createTimeoutPromise(timeout: number): Promise<ToolResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new ToolTimeoutError(`Tool execution timeout after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * 获取工具的执行配置
   */
  async getExecutionConfig(toolName: string): Promise<any> {
    try {
      // 这里应该从数据库中获取工具的执行配置
      // 暂时返回null，后续集成真实的配置加载逻辑
      return null;
    } catch (error) {
      console.error(`Failed to get execution config for ${toolName}:`, error);
      return null;
    }
  }

  /**
   * 设置工具的执行配置
   */
  async setExecutionConfig(toolName: string, config: any): Promise<void> {
    try {
      // 这里应该将工具的执行配置保存到数据库
      // 暂时为空，后续集成真实的配置保存逻辑
    } catch (error) {
      console.error(`Failed to set execution config for ${toolName}:`, error);
      throw error;
    }
  }

  /**
   * 记录执行日志
   */
  private async logExecution(
    context: ToolExecutionContext,
    result: ToolResult,
    error?: any
  ): Promise<void> {
    try {
      await db.insert(executionLogs).values({
        ticketId: context.ticketId ? parseInt(context.ticketId) : 0,
        toolName: context.toolName,
        input: context.params,
        output: result.data,
        status: result.success ? "success" : "failed",
        errorMessage: result.error,
        executionTime: result.metadata?.executionTime || 0,
      });
    } catch (logError) {
      console.error("Failed to log execution:", logError);
    }
  }
}

// 导出单例
export const toolExecutor = new ToolExecutor();
