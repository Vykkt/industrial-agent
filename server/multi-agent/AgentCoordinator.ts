/**
 * Agent协调器 - 管理多Agent的任务分配和协同
 * P1改进：支持Lead-Sub Agent模式和并行执行
 */

import { db } from "../db";
import { multiAgentTasks } from "../../drizzle/schema";
import {
  MultiAgentTask,
  AgentTaskType,
  TaskStatus,
  AgentMessageType,
} from "../config/types";
import { messageBus } from "./MessageBus";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export interface TaskDecomposition {
  leadTask: MultiAgentTask;
  subTasks: MultiAgentTask[];
}

export interface TaskResult {
  taskId: string;
  status: TaskStatus;
  result?: Record<string, any>;
  error?: string;
}

export class AgentCoordinator {
  /**
   * 创建Lead Agent任务
   */
  async createLeadTask(
    objective: string,
    leadAgentId: string = "lead-agent"
  ): Promise<MultiAgentTask> {
    const taskId = nanoid();

    const task: MultiAgentTask = {
      taskId,
      agentId: leadAgentId,
      taskType: AgentTaskType.LEAD,
      objective,
      status: TaskStatus.PENDING,
    };

    await db.insert(multiAgentTasks).values(task);

    return task;
  }

  /**
   * 分解任务为子任务
   */
  async decomposeTask(
    parentTaskId: string,
    subTasks: Array<{
      objective: string;
      agentId: string;
    }>
  ): Promise<TaskDecomposition> {
    // 获取父任务
    const parentTask = await this.getTask(parentTaskId);
    if (!parentTask) {
      throw new Error(`Task not found: ${parentTaskId}`);
    }

    // 创建子任务
    const createdSubTasks: MultiAgentTask[] = [];

    for (const subTask of subTasks) {
      const taskId = nanoid();

      const task: MultiAgentTask = {
        taskId,
        parentTaskId,
        agentId: subTask.agentId,
        taskType: AgentTaskType.SUB,
        objective: subTask.objective,
        status: TaskStatus.PENDING,
      };

      await db.insert(multiAgentTasks).values(task);
      createdSubTasks.push(task);

      // 发送任务分配消息
      await messageBus.sendMessage(
        parentTask.agentId,
        subTask.agentId,
        AgentMessageType.TASK_ASSIGNMENT,
        {
          taskId: task.taskId,
          objective: task.objective,
          parentTaskId,
        }
      );
    }

    return {
      leadTask: parentTask,
      subTasks: createdSubTasks,
    };
  }

  /**
   * 获取任务
   */
  async getTask(taskId: string): Promise<MultiAgentTask | null> {
    const result = await db
      .select()
      .from(multiAgentTasks)
      .where(eq(multiAgentTasks.taskId, taskId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * 更新任务状态
   */
  async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    result?: Record<string, any>,
    error?: string
  ): Promise<void> {
    await db
      .update(multiAgentTasks)
      .set({
        status,
        result,
        errorMessage: error,
        completedAt: [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED].includes(
          status
        )
          ? new Date()
          : undefined,
      })
      .where(eq(multiAgentTasks.taskId, taskId));
  }

  /**
   * 获取子任务
   */
  async getSubTasks(parentTaskId: string): Promise<MultiAgentTask[]> {
    return await db
      .select()
      .from(multiAgentTasks)
      .where(eq(multiAgentTasks.parentTaskId, parentTaskId));
  }

  /**
   * 等待所有子任务完成
   */
  async waitForSubTasksCompletion(
    parentTaskId: string,
    timeout: number = 300000
  ): Promise<{
    completed: boolean;
    results: TaskResult[];
    errors: string[];
  }> {
    const startTime = Date.now();
    const results: TaskResult[] = [];
    const errors: string[] = [];

    while (Date.now() - startTime < timeout) {
      const subTasks = await this.getSubTasks(parentTaskId);

      if (subTasks.length === 0) {
        return { completed: false, results, errors };
      }

      const allCompleted = subTasks.every((task) =>
        [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED].includes(
          task.status!
        )
      );

      if (allCompleted) {
        // 收集结果
        for (const task of subTasks) {
          results.push({
            taskId: task.taskId,
            status: task.status!,
            result: task.result,
            error: task.errorMessage,
          });

          if (task.status === TaskStatus.FAILED) {
            errors.push(`${task.taskId}: ${task.errorMessage}`);
          }
        }

        return { completed: true, results, errors };
      }

      // 等待一段时间后重新检查
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return { completed: false, results, errors };
  }

  /**
   * 聚合子任务结果
   */
  async aggregateResults(parentTaskId: string): Promise<Record<string, any>> {
    const subTasks = await this.getSubTasks(parentTaskId);

    const aggregated: Record<string, any> = {
      totalTasks: subTasks.length,
      completedTasks: 0,
      failedTasks: 0,
      results: {},
    };

    for (const task of subTasks) {
      if (task.status === TaskStatus.COMPLETED) {
        aggregated.completedTasks++;
        aggregated.results[task.taskId] = task.result;
      } else if (task.status === TaskStatus.FAILED) {
        aggregated.failedTasks++;
        aggregated.results[task.taskId] = {
          error: task.errorMessage,
        };
      }
    }

    return aggregated;
  }

  /**
   * 执行并行任务
   */
  async executeParallelTasks(
    objective: string,
    subTaskDefinitions: Array<{
      objective: string;
      agentId: string;
    }>
  ): Promise<TaskResult[]> {
    // 创建Lead任务
    const leadTask = await this.createLeadTask(objective);

    // 分解为子任务
    const decomposition = await this.decomposeTask(leadTask.taskId, subTaskDefinitions);

    // 等待所有子任务完成
    const completion = await this.waitForSubTasksCompletion(leadTask.taskId);

    if (!completion.completed) {
      throw new Error("Parallel tasks did not complete within timeout");
    }

    return completion.results;
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: string): Promise<void> {
    // 更新任务状态
    await this.updateTaskStatus(taskId, TaskStatus.CANCELLED);

    // 取消所有子任务
    const subTasks = await this.getSubTasks(taskId);
    for (const subTask of subTasks) {
      if (![TaskStatus.COMPLETED, TaskStatus.FAILED].includes(subTask.status!)) {
        await this.cancelTask(subTask.taskId);
      }
    }
  }

  /**
   * 获取任务执行统计
   */
  async getTaskStatistics(parentTaskId?: string): Promise<{
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    pendingTasks: number;
    cancelledTasks: number;
  }> {
    let query = db.select().from(multiAgentTasks);

    if (parentTaskId) {
      query = query.where(eq(multiAgentTasks.parentTaskId, parentTaskId));
    }

    const tasks = await query;

    return {
      totalTasks: tasks.length,
      completedTasks: tasks.filter((t) => t.status === TaskStatus.COMPLETED).length,
      failedTasks: tasks.filter((t) => t.status === TaskStatus.FAILED).length,
      pendingTasks: tasks.filter((t) => t.status === TaskStatus.PENDING).length,
      cancelledTasks: tasks.filter((t) => t.status === TaskStatus.CANCELLED).length,
    };
  }
}

// 导出单例
export const agentCoordinator = new AgentCoordinator();
