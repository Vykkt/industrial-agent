/**
 * API工具适配器 - 调用真实的API
 * 支持错误处理、重试、超时等
 */

import axios, { AxiosError } from "axios";
import { IToolAdapter, ITool, ToolParams, ToolResult, ExecutionMode } from "../ITool";

export class APIToolAdapter implements IToolAdapter {
  private readonly DEFAULT_TIMEOUT = 30000; // 30秒
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1秒

  /**
   * 执行工具 - 调用真实API
   */
  async execute(tool: ITool, params: ToolParams): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      // 验证参数
      const validation = tool.validate(params);
      if (!validation.valid) {
        return {
          success: false,
          error: `Parameter validation failed: ${validation.errors?.join(", ")}`,
          metadata: {
            executionTime: Date.now() - startTime,
            source: "api",
            timestamp: new Date(),
          },
        };
      }

      // 获取工具的API端点
      const endpoint = await this.getToolEndpoint(tool.getName());
      if (!endpoint) {
        return {
          success: false,
          error: `No endpoint configured for tool: ${tool.getName()}`,
          metadata: {
            executionTime: Date.now() - startTime,
            source: "api",
            timestamp: new Date(),
          },
        };
      }

      // 执行API调用，支持重试
      const result = await this.executeWithRetry(endpoint, params);

      return {
        success: true,
        data: result,
        metadata: {
          executionTime: Date.now() - startTime,
          source: "api",
          timestamp: new Date(),
        },
      };
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);

      return {
        success: false,
        error: errorMessage,
        metadata: {
          executionTime: Date.now() - startTime,
          source: "api",
          timestamp: new Date(),
        },
      };
    }
  }

  /**
   * 获取适配器模式
   */
  getMode(): ExecutionMode {
    return ExecutionMode.REAL;
  }

  /**
   * 获取工具的API端点
   */
  private async getToolEndpoint(toolName: string): Promise<string | null> {
    // 这里应该从配置中获取工具的API端点
    // 暂时返回null，后续集成真实的配置加载逻辑
    return null;
  }

  /**
   * 执行API调用，支持重试
   */
  private async executeWithRetry(
    endpoint: string,
    params: ToolParams,
    retryCount: number = 0
  ): Promise<any> {
    try {
      const response = await axios.post(endpoint, params, {
        timeout: this.DEFAULT_TIMEOUT,
      });

      return response.data;
    } catch (error) {
      // 判断是否可重试
      if (this.isRetryable(error) && retryCount < this.MAX_RETRIES) {
        // 指数退避算法
        const delay = this.RETRY_DELAY * Math.pow(2, retryCount);
        await new Promise((resolve) => setTimeout(resolve, delay));

        return this.executeWithRetry(endpoint, params, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * 判断错误是否可重试
   */
  private isRetryable(error: any): boolean {
    if (error instanceof AxiosError) {
      // 可重试的HTTP状态码
      const retryableStatus = [408, 429, 500, 502, 503, 504];
      return error.response?.status ? retryableStatus.includes(error.response.status) : true;
    }

    return false;
  }

  /**
   * 提取错误信息
   */
  private extractErrorMessage(error: any): string {
    if (error instanceof AxiosError) {
      if (error.response?.data?.message) {
        return error.response.data.message;
      }

      if (error.response?.statusText) {
        return `HTTP ${error.response.status}: ${error.response.statusText}`;
      }

      if (error.code === "ECONNABORTED") {
        return "Request timeout";
      }

      if (error.code === "ECONNREFUSED") {
        return "Connection refused";
      }

      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return "Unknown error";
  }
}
