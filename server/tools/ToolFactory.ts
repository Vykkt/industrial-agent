/**
 * 工具工厂 - 管理工具的创建和注册
 * P0改进：支持动态工具注册和灵活的工具管理
 */

import { IToolFactory, ITool, ExecutionMode } from "./ITool";
import { MockToolAdapter } from "./adapters/MockToolAdapter";
import { APIToolAdapter } from "./adapters/APIToolAdapter";
import { configManager } from "../config/ConfigManager";

export class ToolFactory implements IToolFactory {
  private tools: Map<string, ITool> = new Map();
  private adapters: Map<ExecutionMode, any> = new Map();

  constructor() {
    // 初始化适配器
    this.adapters.set(ExecutionMode.MOCK, new MockToolAdapter());
    this.adapters.set(ExecutionMode.REAL, new APIToolAdapter());
    this.adapters.set(ExecutionMode.SIMULATION, new MockToolAdapter());
    this.adapters.set(ExecutionMode.DRY_RUN, new MockToolAdapter());
  }

  /**
   * 创建工具实例
   */
  async createTool(toolName: string): Promise<ITool | null> {
    // 首先检查已注册的工具
    if (this.tools.has(toolName)) {
      return this.tools.get(toolName) || null;
    }

    // 从数据库加载工具配置
    // 这里应该从工具表中查询工具定义
    // 暂时返回null，后续集成真实的工具加载逻辑
    return null;
  }

  /**
   * 注册工具
   */
  registerTool(toolName: string, tool: ITool): void {
    this.tools.set(toolName, tool);
  }

  /**
   * 注销工具
   */
  unregisterTool(toolName: string): void {
    this.tools.delete(toolName);
  }

  /**
   * 获取所有注册的工具
   */
  getRegisteredTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * 获取工具
   */
  getTool(toolName: string): ITool | null {
    return this.tools.get(toolName) || null;
  }

  /**
   * 获取适配器
   */
  getAdapter(mode: ExecutionMode): any {
    return this.adapters.get(mode);
  }
}

// 导出单例
export const toolFactory = new ToolFactory();
