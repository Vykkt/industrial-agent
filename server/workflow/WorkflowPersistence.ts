/**
 * 工作流持久化服务 - 事件溯源模式
 * P0改进：支持工作流状态的完整记录和恢复
 */

import { db } from "../db";
import {
  workflowEvents,
  workflowSnapshots,
  workflowConfigurations,
} from "../../drizzle/schema";
import { WorkflowEvent, WorkflowEventType, WorkflowSnapshot } from "../config/types";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

export class WorkflowPersistence {
  private readonly SNAPSHOT_INTERVAL = 10; // 每10个事件创建一个快照

  /**
   * 保存工作流事件
   */
  async saveEvent(
    workflowExecutionId: string,
    eventType: WorkflowEventType,
    eventData?: Record<string, any>,
    stepId?: string,
    errorMessage?: string
  ): Promise<WorkflowEvent> {
    // 获取当前版本号
    const lastEvent = await this.getLastEvent(workflowExecutionId);
    const version = (lastEvent?.version || 0) + 1;

    const event: WorkflowEvent = {
      workflowExecutionId,
      eventType,
      eventData,
      stepId,
      errorMessage,
      version,
    };

    await db.insert(workflowEvents).values(event);

    // 检查是否需要创建快照
    if (version % this.SNAPSHOT_INTERVAL === 0) {
      await this.createSnapshot(workflowExecutionId, version);
    }

    return event;
  }

  /**
   * 获取最后一个事件
   */
  private async getLastEvent(workflowExecutionId: string): Promise<WorkflowEvent | null> {
    const result = await db
      .select()
      .from(workflowEvents)
      .where(eq(workflowEvents.workflowExecutionId, workflowExecutionId))
      .orderBy((t) => t.version)
      .limit(1);

    return result[0] || null;
  }

  /**
   * 获取工作流事件历史
   */
  async getEventHistory(workflowExecutionId: string): Promise<WorkflowEvent[]> {
    return await db
      .select()
      .from(workflowEvents)
      .where(eq(workflowEvents.workflowExecutionId, workflowExecutionId))
      .orderBy((t) => t.version);
  }

  /**
   * 创建工作流快照
   */
  private async createSnapshot(
    workflowExecutionId: string,
    version: number
  ): Promise<void> {
    // 获取该版本之前的所有事件
    const events = await db
      .select()
      .from(workflowEvents)
      .where(
        and(
          eq(workflowEvents.workflowExecutionId, workflowExecutionId),
          (t) => t.version <= version
        )
      )
      .orderBy((t) => t.version);

    // 重建状态
    const state = this.rebuildState(events);

    // 获取最后一个事件的stepId作为currentStepId
    const lastEvent = events[events.length - 1];
    const currentStepId = lastEvent?.stepId;

    // 获取工作流配置ID（从第一个事件的eventData中获取）
    const firstEvent = events[0];
    const workflowConfigId = firstEvent?.eventData?.workflowConfigId || 0;

    // 保存快照
    await db
      .delete(workflowSnapshots)
      .where(eq(workflowSnapshots.workflowExecutionId, workflowExecutionId));

    await db.insert(workflowSnapshots).values({
      workflowExecutionId,
      workflowConfigId,
      state,
      currentStepId,
      version,
    });
  }

  /**
   * 重建工作流状态
   */
  private rebuildState(events: WorkflowEvent[]): Record<string, any> {
    const state: Record<string, any> = {
      steps: {},
      variables: {},
      executionPath: [],
    };

    for (const event of events) {
      switch (event.eventType) {
        case WorkflowEventType.STARTED:
          state.startedAt = event.eventData?.timestamp;
          state.variables = event.eventData?.variables || {};
          break;

        case WorkflowEventType.STEP_EXECUTED:
          if (event.stepId) {
            state.steps[event.stepId] = {
              status: "completed",
              result: event.eventData?.result,
              executedAt: event.eventData?.timestamp,
            };
            state.executionPath.push(event.stepId);
          }
          break;

        case WorkflowEventType.STEP_FAILED:
          if (event.stepId) {
            state.steps[event.stepId] = {
              status: "failed",
              error: event.errorMessage,
              failedAt: event.eventData?.timestamp,
            };
          }
          break;

        case WorkflowEventType.BRANCH_TAKEN:
          state.lastBranch = event.eventData?.branchId;
          break;

        case WorkflowEventType.PAUSED:
          state.pausedAt = event.eventData?.timestamp;
          break;

        case WorkflowEventType.RESUMED:
          state.resumedAt = event.eventData?.timestamp;
          break;

        case WorkflowEventType.COMPLETED:
          state.completedAt = event.eventData?.timestamp;
          state.result = event.eventData?.result;
          break;

        case WorkflowEventType.FAILED:
          state.failedAt = event.eventData?.timestamp;
          state.error = event.errorMessage;
          break;

        case WorkflowEventType.CANCELLED:
          state.cancelledAt = event.eventData?.timestamp;
          break;
      }
    }

    return state;
  }

  /**
   * 获取工作流快照
   */
  async getSnapshot(workflowExecutionId: string): Promise<WorkflowSnapshot | null> {
    const result = await db
      .select()
      .from(workflowSnapshots)
      .where(eq(workflowSnapshots.workflowExecutionId, workflowExecutionId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * 获取所有快照
   */
  async getSnapshots(workflowExecutionId: string): Promise<WorkflowSnapshot[]> {
    return await db
      .select()
      .from(workflowSnapshots)
      .where(eq(workflowSnapshots.workflowExecutionId, workflowExecutionId))
      .orderBy((t) => t.version);
  }

  /**
   * 从快照恢复工作流状态
   */
  async recoverFromSnapshot(
    workflowExecutionId: string
  ): Promise<{ state: Record<string, any>; version: number } | null> {
    const snapshot = await this.getSnapshot(workflowExecutionId);

    if (!snapshot) {
      return null;
    }

    // 获取快照之后的事件
    const laterEvents = await db
      .select()
      .from(workflowEvents)
      .where(
        and(
          eq(workflowEvents.workflowExecutionId, workflowExecutionId),
          (t) => t.version > snapshot.version
        )
      )
      .orderBy((t) => t.version);

    // 重建状态
    let state = snapshot.state;
    if (laterEvents.length > 0) {
      state = this.rebuildState([...laterEvents]);
    }

    return {
      state,
      version: snapshot.version + laterEvents.length,
    };
  }

  /**
   * 清理旧的事件和快照
   */
  async cleanup(workflowExecutionId: string, keepVersions: number = 5): Promise<void> {
    // 获取所有快照
    const snapshots = await this.getSnapshots(workflowExecutionId);

    if (snapshots.length > keepVersions) {
      // 删除旧的快照
      const snapshotsToDelete = snapshots.slice(0, snapshots.length - keepVersions);
      for (const snapshot of snapshotsToDelete) {
        if (snapshot.id) {
          await db
            .delete(workflowSnapshots)
            .where(eq(workflowSnapshots.id, snapshot.id));
        }
      }
    }

    // 删除旧的事件（只保留最新的快照之后的事件）
    const latestSnapshot = snapshots[snapshots.length - 1];
    if (latestSnapshot) {
      await db
        .delete(workflowEvents)
        .where(
          and(
            eq(workflowEvents.workflowExecutionId, workflowExecutionId),
            (t) => t.version < latestSnapshot.version - 100
          )
        );
    }
  }
}

// 导出单例
export const workflowPersistence = new WorkflowPersistence();
