/**
 * 配置管理API路由
 * P0改进：支持系统配置、工具配置、工作流配置的CRUD操作
 */

import { Router, Request, Response } from "express";
import { configManager } from "./ConfigManager";
import {
  SystemConnectionConfig,
  ToolConfig,
  WorkflowConfig,
} from "./types";

const router = Router();

/**
 * 系统连接配置路由
 */

// 获取所有系统连接
router.get("/systems", async (req: Request, res: Response) => {
  try {
    const connections = await configManager.listSystemConnections();
    res.json(connections);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// 获取单个系统连接
router.get("/systems/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const connection = await configManager.getSystemConnection(id);

    if (!connection) {
      return res.status(404).json({ error: "System connection not found" });
    }

    res.json(connection);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// 创建系统连接
router.post("/systems", async (req: Request, res: Response) => {
  try {
    const config: SystemConnectionConfig = req.body;

    // 验证配置
    const validation = configManager.validateSystemConnection(config);
    if (!validation.valid) {
      return res.status(400).json({
        error: "Invalid configuration",
        details: validation.errors,
      });
    }

    const result = await configManager.createSystemConnection(config);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// 更新系统连接
router.put("/systems/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const config: Partial<SystemConnectionConfig> = req.body;

    const existing = await configManager.getSystemConnection(id);
    if (!existing) {
      return res.status(404).json({ error: "System connection not found" });
    }

    // 验证更新后的配置
    const merged = { ...existing, ...config };
    const validation = configManager.validateSystemConnection(merged);
    if (!validation.valid) {
      return res.status(400).json({
        error: "Invalid configuration",
        details: validation.errors,
      });
    }

    await configManager.updateSystemConnection(id, config);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// 删除系统连接
router.delete("/systems/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    await configManager.deleteSystemConnection(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// 测试系统连接
router.post("/systems/:id/test", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const result = await configManager.testSystemConnection(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * 工具配置路由
 */

// 获取所有工具配置
router.get("/tools", async (req: Request, res: Response) => {
  try {
    const configs = await configManager.listToolConfigurations();
    res.json(configs);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// 获取单个工具配置
router.get("/tools/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const config = await configManager.getToolConfiguration(id);

    if (!config) {
      return res.status(404).json({ error: "Tool configuration not found" });
    }

    res.json(config);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// 创建工具配置
router.post("/tools", async (req: Request, res: Response) => {
  try {
    const config: ToolConfig = req.body;

    // 验证配置
    const validation = configManager.validateToolConfiguration(config);
    if (!validation.valid) {
      return res.status(400).json({
        error: "Invalid configuration",
        details: validation.errors,
      });
    }

    const result = await configManager.createToolConfiguration(config);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// 更新工具配置
router.put("/tools/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const config: Partial<ToolConfig> = req.body;

    const existing = await configManager.getToolConfiguration(id);
    if (!existing) {
      return res.status(404).json({ error: "Tool configuration not found" });
    }

    // 验证更新后的配置
    const merged = { ...existing, ...config };
    const validation = configManager.validateToolConfiguration(merged);
    if (!validation.valid) {
      return res.status(400).json({
        error: "Invalid configuration",
        details: validation.errors,
      });
    }

    await configManager.updateToolConfiguration(id, config);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// 删除工具配置
router.delete("/tools/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    await configManager.deleteToolConfiguration(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * 工作流配置路由
 */

// 获取所有工作流配置
router.get("/workflows", async (req: Request, res: Response) => {
  try {
    const configs = await configManager.listWorkflowConfigurations();
    res.json(configs);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// 获取单个工作流配置
router.get("/workflows/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const config = await configManager.getWorkflowConfiguration(id);

    if (!config) {
      return res.status(404).json({ error: "Workflow configuration not found" });
    }

    res.json(config);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// 创建工作流配置
router.post("/workflows", async (req: Request, res: Response) => {
  try {
    const config: WorkflowConfig = req.body;

    // 验证配置
    const validation = configManager.validateWorkflowConfiguration(config);
    if (!validation.valid) {
      return res.status(400).json({
        error: "Invalid configuration",
        details: validation.errors,
      });
    }

    const result = await configManager.createWorkflowConfiguration(config);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// 更新工作流配置
router.put("/workflows/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const config: Partial<WorkflowConfig> = req.body;

    const existing = await configManager.getWorkflowConfiguration(id);
    if (!existing) {
      return res.status(404).json({ error: "Workflow configuration not found" });
    }

    // 验证更新后的配置
    const merged = { ...existing, ...config };
    const validation = configManager.validateWorkflowConfiguration(merged);
    if (!validation.valid) {
      return res.status(400).json({
        error: "Invalid configuration",
        details: validation.errors,
      });
    }

    await configManager.updateWorkflowConfiguration(id, config);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// 删除工作流配置
router.delete("/workflows/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    await configManager.deleteWorkflowConfiguration(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
