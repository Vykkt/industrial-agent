/**
 * Mock工具适配器 - 返回模拟数据
 * 用于开发、测试和演示
 */

import { IToolAdapter, ITool, ToolParams, ToolResult, ExecutionMode } from "../ITool";

export class MockToolAdapter implements IToolAdapter {
  /**
   * 执行工具 - 返回模拟数据
   */
  async execute(tool: ITool, params: ToolParams): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      // 模拟执行延迟
      await this.simulateDelay();

      // 根据工具名称返回相应的模拟数据
      const mockData = this.generateMockData(tool.getName(), params);

      return {
        success: true,
        data: mockData,
        metadata: {
          executionTime: Date.now() - startTime,
          source: "mock",
          timestamp: new Date(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          executionTime: Date.now() - startTime,
          source: "mock",
          timestamp: new Date(),
        },
      };
    }
  }

  /**
   * 获取适配器模式
   */
  getMode(): ExecutionMode {
    return ExecutionMode.MOCK;
  }

  /**
   * 模拟执行延迟
   */
  private async simulateDelay(): Promise<void> {
    const delay = Math.random() * 500 + 100; // 100-600ms
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * 生成模拟数据
   */
  private generateMockData(toolName: string, params: ToolParams): any {
    // 根据工具名称生成相应的模拟数据
    switch (toolName) {
      case "query_erp_order":
        return {
          orderId: "ORD-2024-001",
          customerName: "示例客户",
          amount: 10000,
          status: "已发货",
          items: [
            { sku: "SKU-001", quantity: 10, price: 1000 },
            { sku: "SKU-002", quantity: 5, price: 200 },
          ],
        };

      case "query_mes_production":
        return {
          productionId: "PROD-2024-001",
          status: "生产中",
          progress: 75,
          plannedCompletion: new Date(Date.now() + 2 * 60 * 60 * 1000),
          equipment: [
            { id: "EQ-001", status: "运行中", utilization: 85 },
            { id: "EQ-002", status: "运行中", utilization: 92 },
          ],
        };

      case "query_device_status":
        return {
          deviceId: params.deviceId || "DEV-001",
          status: "正常",
          temperature: 45,
          pressure: 2.5,
          lastMaintenance: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          nextMaintenance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        };

      case "query_inventory":
        return {
          warehouseId: params.warehouseId || "WH-001",
          items: [
            { sku: "SKU-001", quantity: 100, location: "A-01-01" },
            { sku: "SKU-002", quantity: 50, location: "B-02-03" },
            { sku: "SKU-003", quantity: 200, location: "C-03-05" },
          ],
          totalValue: 50000,
        };

      case "create_maintenance_order":
        return {
          orderId: "MNT-" + Date.now(),
          status: "已创建",
          deviceId: params.deviceId,
          maintenanceType: params.type || "预防性维护",
          scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          estimatedDuration: "2小时",
        };

      case "submit_quality_check":
        return {
          checkId: "QC-" + Date.now(),
          status: "已提交",
          productId: params.productId,
          result: "合格",
          defectRate: 0.2,
          timestamp: new Date(),
        };

      default:
        return {
          toolName,
          params,
          message: "Mock data for " + toolName,
          timestamp: new Date(),
        };
    }
  }
}
