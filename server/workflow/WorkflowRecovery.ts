/**
 * 工作流恢复服务 - 支持从检查点恢复和错误恢复
 * P0改进：支持工作流的可靠执行和故障恢复
 */

import { db } from "../db";
import { workflowSnapshots, workflowEvents } from "../../drizzle/schema";
import { workflowPersistence } from "./WorkflowPersistence";
import { eq } from "drizzle-orm";

export interface RecoveryCheckpoint {
  workflowExecutionId: string;
  state: Record<string, any>;
  version: number;
  currentStepId?: string;
  recoveryTime: Date;
}

export interface RecoveryStrategy {
  type: "retry" | "skip" | "rollback" | "manual";
  maxRetries?: number;
  retryDelay?: number;
}

export class WorkflowRecovery {
  /**
   * 创建检查点
   */
  async createCheckpoint(
    workflowExecutionId: string,
    state: Record<string, any>,
    currentStepId?: string
  ): Promise<RecoveryCheckpoint> {
    const snapshot = await workflowPersistence.getSnapshot(workflowExecutionId);
    const version = (snapshot?.version || 0) + 1;

    // 保存快照
    await db.insert(workflowSnapshots).values({
      workflowExecutionId,
      workflowConfigId: state.workflowConfigId || 0,
      state,
      currentStepId,
      version,
    });

    return {
      workflowExecutionId,
      state,
      version,
      currentStepId,
      recoveryTime: new Date(),
    };
  }

  /**
   * 从检查点恢复
   */
  async recoverFromCheckpoint(
    workflowExecutionId: string
  ): Promise<RecoveryCheckpoint | null> {
    const recovery = await workflowPersistence.recoverFromSnapshot(
      workflowExecutionId
    );

    if (!recovery) {
      return null;
    }

    const snapshot = await workflowPersistence.getSnapshot(workflowExecutionId);

    return {
      workflowExecutionId,
      state: recovery.state,
      version: recovery.version,
      currentStepId: snapshot?.currentStepId,
      recoveryTime: new Date(),
    };
  }

  /**
   * 处理步骤失败
   */
  async handleStepFailure(
    workflowExecutionId: string,
    stepId: string,
    error: string,
    strategy: RecoveryStrategy = { type: "retry", maxRetries: 3, retryDelay: 1000 }
  ): Promise<{ recovered: boolean; action: string; details?: any }> {
    try {
      switch (strategy.type) {
        case "retry":
          return await this.retryStep(
            workflowExecutionId,
            stepId,
            strategy.maxRetries || 3,
            strategy.retryDelay || 1000
          );

        case "skip":
          return await this.skipStep(workflowExecutionId, stepId);

        case "rollback":
          return await this.rollbackToCheckpoint(workflowExecutionId);

        case "manual":
          return {
            recovered: false,
            action: "manual",
            details: { stepId, error, requiresManualIntervention: true },
          };

        default:
          return {
            recovered: false,
            action: "unknown",
            details: { error: "Unknown recovery strategy" },
          };
      }
    } catch (recoveryError) {
      return {
        recovered: false,
        action: "failed",
        details: {
          originalError: error,
          recoveryError: recoveryError instanceof Error ? recoveryError.message : "Unknown",
        },
      };
    }
  }

  /**
   * 重试步骤
   */
  private async retryStep(
    workflowExecutionId: string,
    stepId: string,
    maxRetries: number,
    retryDelay: number
  ): Promise<{ recovered: boolean; action: string; details?: any }> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // 等待重试延迟
      if (attempt > 1) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
      }

      // 这里应该重新执行步骤
      // 暂时返回成功，后续集成真实的步骤执行逻辑
      return {
        recovered: true,
        action: "retry",
        details: { stepId, attempt, maxRetries },
      };
    }

    return {
      recovered: false,
      action: "retry_exhausted",
      details: { stepId, maxRetries },
    };
  }

  /**
   * 跳过步骤
   */
  private async skipStep(
    workflowExecutionId: string,
    stepId: string
  ): Promise<{ recovered: boolean; action: string; details?: any }> {
    // 记录跳过事件
    // 暂时返回成功，后续集成真实的事件记录逻辑

    return {
      recovered: true,
      action: "skip",
      details: { stepId, skipped: true },
    };
  }

  /**
   * 回退到检查点
   */
  private async rollbackToCheckpoint(
    workflowExecutionId: string
  ): Promise<{ recovered: boolean; action: string; details?: any }> {
    const checkpoint = await this.recoverFromCheckpoint(workflowExecutionId);

    if (!checkpoint) {
      return {
        recovered: false,
        action: "rollback_failed",
        details: { error: "No checkpoint found" },
      };
    }

    return {
      recovered: true,
      action: "rollback",
      details: {
        workflowExecutionId,
        restoredVersion: checkpoint.version,
        restoredAt: checkpoint.recoveryTime,
      },
    };
  }

  /**
   * 获取工作流执行历史
   */
  async getExecutionHistory(workflowExecutionId: string): Promise<any[]> {
    const events = await workflowPersistence.getEventHistory(workflowExecutionId);

    return events.map((event) => ({
      version: event.version,
      type: event.eventType,
      stepId: event.stepId,
      timestamp: event.createdAt,
      data: event.eventData,
      error: event.errorMessage,
    }));
  }

  /**
   * 分析失败原因
   */
  async analyzeFailure(
    workflowExecutionId: string
  ): Promise<{
    failurePoint: string;
    failureReason: string;
    failureContext: Record<string, any>;
    recommendations: string[];
  }> {
    const history = await this.getExecutionHistory(workflowExecutionId);

    // 找到最后一个失败事件
    const failureEvent = history.reverse().find((e) => e.type === "step_failed");

    if (!failureEvent) {
      return {
        failurePoint: "unknown",
        failureReason: "No failure event found",
        failureContext: {},
        recommendations: [],
      };
    }

    const recommendations: string[] = [];

    // 根据错误类型提供建议
    if (failureEvent.error?.includes("timeout")) {
      recommendations.push("Increase timeout configuration");
      recommendations.push("Check system performance");
    } else if (failureEvent.error?.includes("connection")) {
      recommendations.push("Check network connectivity");
      recommendations.push("Verify API endpoint configuration");
    } else if (failureEvent.error?.includes("validation")) {
      recommendations.push("Review input parameters");
      recommendations.push("Check data format and types");
    }

    return {
      failurePoint: failureEvent.stepId || "unknown",
      failureReason: failureEvent.error || "Unknown error",
      failureContext: failureEvent.data || {},
      recommendations,
    };
  }

  /**
   * 清理恢复数据
   */
  async cleanup(workflowExecutionId: string): Promise<void> {
    await workflowPersistence.cleanup(workflowExecutionId);
  }
}

// 导出单例
export const workflowRecovery = new WorkflowRecovery();
