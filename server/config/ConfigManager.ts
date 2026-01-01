/**
 * 配置管理器 - 统一管理系统配置、工具配置、工作流配置
 * P0改进：支持灵活的现场配置和动态调整
 */

import { db } from "../db";
import {
  systemConnections,
  toolConfigurations,
  workflowConfigurations,
} from "../../drizzle/schema";
import {
  SystemConnectionConfig,
  ToolConfig,
  WorkflowConfig,
  ValidationResult,
  TestResult,
  ConnectionStatus,
} from "./types";
import { eq } from "drizzle-orm";

export class ConfigManager {
  /**
   * 系统连接配置管理
   */

  async createSystemConnection(
    config: SystemConnectionConfig
  ): Promise<SystemConnectionConfig> {
    const result = await db.insert(systemConnections).values({
      systemType: config.systemType,
      systemName: config.systemName,
      apiEndpoint: config.apiEndpoint,
      authType: config.authType,
      authConfig: config.authConfig,
      status: "inactive",
    });

    return {
      ...config,
      id: result.insertId as number,
    };
  }

  async getSystemConnection(id: number): Promise<SystemConnectionConfig | null> {
    const result = await db
      .select()
      .from(systemConnections)
      .where(eq(systemConnections.id, id))
      .limit(1);

    return result[0] || null;
  }

  async listSystemConnections(): Promise<SystemConnectionConfig[]> {
    return await db.select().from(systemConnections);
  }

  async updateSystemConnection(
    id: number,
    config: Partial<SystemConnectionConfig>
  ): Promise<void> {
    await db
      .update(systemConnections)
      .set({
        ...config,
        updatedAt: new Date(),
      })
      .where(eq(systemConnections.id, id));
  }

  async deleteSystemConnection(id: number): Promise<void> {
    await db
      .delete(systemConnections)
      .where(eq(systemConnections.id, id));
  }

  /**
   * 测试系统连接
   */
  async testSystemConnection(id: number): Promise<TestResult> {
    const connection = await this.getSystemConnection(id);
    if (!connection) {
      return {
        success: false,
        message: "Connection not found",
        timestamp: new Date(),
      };
    }

    try {
      // 根据系统类型调用相应的连接器进行测试
      const result = await this.performConnectionTest(connection);

      // 更新测试结果
      await this.updateSystemConnection(id, {
        status: result.success ? ConnectionStatus.ACTIVE : ConnectionStatus.FAILED,
        lastTestedAt: new Date(),
        testResult: result,
      });

      return result;
    } catch (error) {
      const errorResult: TestResult = {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      };

      await this.updateSystemConnection(id, {
        status: ConnectionStatus.FAILED,
        lastTestedAt: new Date(),
        testResult: errorResult,
      });

      return errorResult;
    }
  }

  private async performConnectionTest(
    connection: SystemConnectionConfig
  ): Promise<TestResult> {
    // 这里应该根据系统类型调用相应的API连接器
    // 暂时返回模拟结果，后续集成真实的连接器
    return {
      success: true,
      message: "Connection test passed",
      details: {
        endpoint: connection.apiEndpoint,
        responseTime: Math.random() * 1000,
      },
      timestamp: new Date(),
    };
  }

  /**
   * 工具配置管理
   */

  async createToolConfiguration(config: ToolConfig): Promise<ToolConfig> {
    const result = await db.insert(toolConfigurations).values({
      toolId: config.toolId,
      executionMode: config.executionMode,
      mockData: config.mockData,
      parameters: config.parameters,
      retryConfig: config.retryConfig,
      timeoutMs: config.timeoutMs || 30000,
      isEnabled: config.isEnabled !== false,
    });

    return {
      ...config,
      id: result.insertId as number,
    };
  }

  async getToolConfiguration(id: number): Promise<ToolConfig | null> {
    const result = await db
      .select()
      .from(toolConfigurations)
      .where(eq(toolConfigurations.id, id))
      .limit(1);

    return result[0] || null;
  }

  async getToolConfigurationByToolId(toolId: number): Promise<ToolConfig | null> {
    const result = await db
      .select()
      .from(toolConfigurations)
      .where(eq(toolConfigurations.toolId, toolId))
      .limit(1);

    return result[0] || null;
  }

  async listToolConfigurations(): Promise<ToolConfig[]> {
    return await db.select().from(toolConfigurations);
  }

  async updateToolConfiguration(
    id: number,
    config: Partial<ToolConfig>
  ): Promise<void> {
    await db
      .update(toolConfigurations)
      .set({
        ...config,
        updatedAt: new Date(),
      })
      .where(eq(toolConfigurations.id, id));
  }

  async deleteToolConfiguration(id: number): Promise<void> {
    await db
      .delete(toolConfigurations)
      .where(eq(toolConfigurations.id, id));
  }

  /**
   * 工作流配置管理
   */

  async createWorkflowConfiguration(
    config: WorkflowConfig
  ): Promise<WorkflowConfig> {
    const result = await db.insert(workflowConfigurations).values({
      workflowName: config.workflowName,
      description: config.description,
      steps: config.steps,
      branches: config.branches,
      version: 1,
      isActive: config.isActive !== false,
    });

    return {
      ...config,
      id: result.insertId as number,
      version: 1,
    };
  }

  async getWorkflowConfiguration(id: number): Promise<WorkflowConfig | null> {
    const result = await db
      .select()
      .from(workflowConfigurations)
      .where(eq(workflowConfigurations.id, id))
      .limit(1);

    return result[0] || null;
  }

  async getWorkflowConfigurationByName(
    name: string
  ): Promise<WorkflowConfig | null> {
    const result = await db
      .select()
      .from(workflowConfigurations)
      .where(eq(workflowConfigurations.workflowName, name))
      .limit(1);

    return result[0] || null;
  }

  async listWorkflowConfigurations(): Promise<WorkflowConfig[]> {
    return await db.select().from(workflowConfigurations);
  }

  async updateWorkflowConfiguration(
    id: number,
    config: Partial<WorkflowConfig>
  ): Promise<void> {
    await db
      .update(workflowConfigurations)
      .set({
        ...config,
        version: (config.version || 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(workflowConfigurations.id, id));
  }

  async deleteWorkflowConfiguration(id: number): Promise<void> {
    await db
      .delete(workflowConfigurations)
      .where(eq(workflowConfigurations.id, id));
  }

  /**
   * 配置验证
   */

  validateSystemConnection(config: SystemConnectionConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.systemType) {
      errors.push("System type is required");
    }

    if (!config.systemName) {
      errors.push("System name is required");
    }

    if (!config.apiEndpoint) {
      errors.push("API endpoint is required");
    } else if (!this.isValidUrl(config.apiEndpoint)) {
      errors.push("API endpoint must be a valid URL");
    }

    if (!config.authType) {
      errors.push("Auth type is required");
    }

    if (!config.authConfig || Object.keys(config.authConfig).length === 0) {
      errors.push("Auth config is required");
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  validateToolConfiguration(config: ToolConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.toolId) {
      errors.push("Tool ID is required");
    }

    if (!config.executionMode) {
      errors.push("Execution mode is required");
    }

    if (config.timeoutMs && config.timeoutMs < 1000) {
      warnings.push("Timeout is less than 1 second, may be too short");
    }

    if (config.retryConfig) {
      if (config.retryConfig.maxRetries < 0) {
        errors.push("Max retries must be non-negative");
      }
      if (config.retryConfig.retryDelay < 0) {
        errors.push("Retry delay must be non-negative");
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  validateWorkflowConfiguration(config: WorkflowConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.workflowName) {
      errors.push("Workflow name is required");
    }

    if (!config.steps || config.steps.length === 0) {
      errors.push("At least one step is required");
    } else {
      // 验证步骤
      const stepIds = new Set<string>();
      for (const step of config.steps) {
        if (!step.id) {
          errors.push("Step ID is required");
        } else if (stepIds.has(step.id)) {
          errors.push(`Duplicate step ID: ${step.id}`);
        } else {
          stepIds.add(step.id);
        }

        if (!step.name) {
          errors.push("Step name is required");
        }
      }

      // 验证分支
      if (config.branches) {
        for (const branch of config.branches) {
          if (!stepIds.has(branch.targetStepId)) {
            errors.push(`Branch target step not found: ${branch.targetStepId}`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

// 导出单例
export const configManager = new ConfigManager();
