/**
 * 多Agent协同API路由
 * P1改进：支持任务分配、进度跟踪、结果聚合等
 */

import { Router, Request, Response } from "express";
import { agentCoordinator } from "./AgentCoordinator";
import { messageBus } from "./MessageBus";

const router = Router();

/**
 * 任务管理
 */

// 创建Lead任务
router.post("/tasks", async (req: Request, res: Response) => {
  try {
    const { objective, leadAgentId } = req.body;

    if (!objective) {
      return res.status(400).json({ error: "Objective is required" });
    }

    const task = await agentCoordinator.createLeadTask(objective, leadAgentId);
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// 获取任务详情
router.get("/tasks/:taskId", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const task = await agentCoordinator.getTask(taskId);

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// 更新任务状态
router.put("/tasks/:taskId/status", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { status, result, error } = req.body;

    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    await agentCoordinator.updateTaskStatus(taskId, status, result, error);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// 取消任务
router.post("/tasks/:taskId/cancel", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    await agentCoordinator.cancelTask(taskId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * 任务分解
 */

// 分解任务为子任务
router.post("/tasks/:taskId/decompose", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { subTasks } = req.body;

    if (!subTasks || !Array.isArray(subTasks)) {
      return res.status(400).json({ error: "subTasks array is required" });
    }

    const decomposition = await agentCoordinator.decomposeTask(taskId, subTasks);
    res.json(decomposition);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// 获取子任务
router.get("/tasks/:taskId/subtasks", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const subTasks = await agentCoordinator.getSubTasks(taskId);
    res.json(subTasks);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * 进度跟踪
 */

// 等待子任务完成
router.post("/tasks/:taskId/wait", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { timeout } = req.body;

    const completion = await agentCoordinator.waitForSubTasksCompletion(
      taskId,
      timeout || 300000
    );

    res.json(completion);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// 获取任务统计
router.get("/tasks/:taskId/statistics", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const statistics = await agentCoordinator.getTaskStatistics(taskId);
    res.json(statistics);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * 结果聚合
 */

// 聚合子任务结果
router.get("/tasks/:taskId/results", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const aggregated = await agentCoordinator.aggregateResults(taskId);
    res.json(aggregated);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * 并行任务执行
 */

// 执行并行任务
router.post("/parallel", async (req: Request, res: Response) => {
  try {
    const { objective, subTasks } = req.body;

    if (!objective) {
      return res.status(400).json({ error: "Objective is required" });
    }

    if (!subTasks || !Array.isArray(subTasks)) {
      return res.status(400).json({ error: "subTasks array is required" });
    }

    const results = await agentCoordinator.executeParallelTasks(objective, subTasks);
    res.json(results);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * 消息管理
 */

// 获取待处理消息
router.get("/messages/:agentId/pending", async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const messages = await messageBus.getPendingMessages(agentId);
    res.json(messages);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// 获取消息历史
router.get("/messages/history", async (req: Request, res: Response) => {
  try {
    const { fromAgentId, toAgentId, limit } = req.query;

    const history = await messageBus.getMessageHistory(
      fromAgentId as string,
      toAgentId as string,
      parseInt(limit as string) || 100
    );

    res.json(history);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
