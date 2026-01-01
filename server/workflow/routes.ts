/**
 * 工作流API路由
 * P0改进：支持工作流的持久化、恢复、查询等操作
 */

import { Router, Request, Response } from "express";
import { workflowPersistence } from "./WorkflowPersistence";
import { workflowRecovery } from "./WorkflowRecovery";
import { WorkflowEventType } from "../config/types";

const router = Router();

/**
 * 工作流事件管理
 */

// 保存工作流事件
router.post("/events", async (req: Request, res: Response) => {
  try {
    const {
      workflowExecutionId,
      eventType,
      eventData,
      stepId,
      errorMessage,
    } = req.body;

    const event = await workflowPersistence.saveEvent(
      workflowExecutionId,
      eventType as WorkflowEventType,
      eventData,
      stepId,
      errorMessage
    );

    res.status(201).json(event);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// 获取工作流事件历史
router.get("/:workflowExecutionId/events", async (req: Request, res: Response) => {
  try {
    const { workflowExecutionId } = req.params;
    const events = await workflowPersistence.getEventHistory(workflowExecutionId);

    res.json(events);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * 工作流快照管理
 */

// 获取工作流快照
router.get("/:workflowExecutionId/snapshots", async (req: Request, res: Response) => {
  try {
    const { workflowExecutionId } = req.params;
    const snapshots = await workflowPersistence.getSnapshots(workflowExecutionId);

    res.json(snapshots);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// 获取最新快照
router.get("/:workflowExecutionId/snapshot", async (req: Request, res: Response) => {
  try {
    const { workflowExecutionId } = req.params;
    const snapshot = await workflowPersistence.getSnapshot(workflowExecutionId);

    if (!snapshot) {
      return res.status(404).json({ error: "Snapshot not found" });
    }

    res.json(snapshot);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * 工作流恢复
 */

// 创建检查点
router.post("/checkpoints", async (req: Request, res: Response) => {
  try {
    const { workflowExecutionId, state, currentStepId } = req.body;

    const checkpoint = await workflowRecovery.createCheckpoint(
      workflowExecutionId,
      state,
      currentStepId
    );

    res.status(201).json(checkpoint);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// 从检查点恢复
router.post("/:workflowExecutionId/recover", async (req: Request, res: Response) => {
  try {
    const { workflowExecutionId } = req.params;

    const checkpoint = await workflowRecovery.recoverFromCheckpoint(
      workflowExecutionId
    );

    if (!checkpoint) {
      return res.status(404).json({ error: "No checkpoint found for recovery" });
    }

    res.json(checkpoint);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// 处理步骤失败
router.post("/:workflowExecutionId/handle-failure", async (req: Request, res: Response) => {
  try {
    const { workflowExecutionId } = req.params;
    const { stepId, error, strategy } = req.body;

    const result = await workflowRecovery.handleStepFailure(
      workflowExecutionId,
      stepId,
      error,
      strategy
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * 工作流分析
 */

// 获取执行历史
router.get("/:workflowExecutionId/history", async (req: Request, res: Response) => {
  try {
    const { workflowExecutionId } = req.params;
    const history = await workflowRecovery.getExecutionHistory(workflowExecutionId);

    res.json(history);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// 分析失败原因
router.get("/:workflowExecutionId/analyze-failure", async (req: Request, res: Response) => {
  try {
    const { workflowExecutionId } = req.params;
    const analysis = await workflowRecovery.analyzeFailure(workflowExecutionId);

    res.json(analysis);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * 清理
 */

// 清理工作流数据
router.delete("/:workflowExecutionId/cleanup", async (req: Request, res: Response) => {
  try {
    const { workflowExecutionId } = req.params;
    await workflowRecovery.cleanup(workflowExecutionId);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
