/**
 * 端到端工业流程工作流
 * 从销售订单到发货的完整流程
 * 
 * 流程：
 * 1. 销售订单 (ERP)
 * 2. 生产订单 (ERP)
 * 3. BOM设计和修改 (PLM) - 特别是修改机油物料号
 * 4. 采购订单 (ERP)
 * 5. 生产执行 (MES)
 * 6. 质量检测 (MES)
 * 7. 发货 (仓库)
 */

import { ERPSystem } from './mock-systems/erp-system';
import { PLMSystem } from './mock-systems/plm-system';
import { MESSystem } from './mock-systems/mes-system';
import { WarehouseSystem } from './mock-systems/warehouse-system';

export interface WorkflowExecutionLog {
  timestamp: Date;
  phase: string;
  agent: string;
  action: string;
  status: 'success' | 'error' | 'warning';
  details?: any;
  error?: string;
}

export interface WorkflowExecutionReport {
  workflowId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed';
  logs: WorkflowExecutionLog[];
  summary: {
    totalPhases: number;
    completedPhases: number;
    failedPhases: number;
    duration?: number; // 毫秒
  };
}

export class E2EWorkflowExecutor {
  private erp: ERPSystem;
  private plm: PLMSystem;
  private mes: MESSystem;
  private warehouse: WarehouseSystem;
  private executionReport: WorkflowExecutionReport;

  constructor(
    erpSystem: ERPSystem,
    plmSystem: PLMSystem,
    mesSystem: MESSystem,
    warehouseSystem: WarehouseSystem
  ) {
    this.erp = erpSystem;
    this.plm = plmSystem;
    this.mes = mesSystem;
    this.warehouse = warehouseSystem;

    this.executionReport = {
      workflowId: `WF-${Date.now()}`,
      startTime: new Date(),
      status: 'running',
      logs: [],
      summary: {
        totalPhases: 7,
        completedPhases: 0,
        failedPhases: 0,
      },
    };
  }

  /**
   * 记录执行日志
   */
  private logExecution(
    phase: string,
    agent: string,
    action: string,
    status: 'success' | 'error' | 'warning',
    details?: any,
    error?: string
  ): void {
    const log: WorkflowExecutionLog = {
      timestamp: new Date(),
      phase,
      agent,
      action,
      status,
      details,
      error,
    };

    this.executionReport.logs.push(log);

    if (status === 'success') {
      this.executionReport.summary.completedPhases++;
    } else if (status === 'error') {
      this.executionReport.summary.failedPhases++;
    }

    const icon = status === 'success' ? '✓' : status === 'error' ? '✗' : '⚠';
    console.log(
      `${icon} [${phase}] ${agent}: ${action}${error ? ` - ${error}` : ''}`
    );
  }

  /**
   * 执行完整的端到端工作流
   */
  async executeWorkflow(): Promise<WorkflowExecutionReport> {
    try {
      console.log('\n========================================');
      console.log('开始执行端到端工业流程工作流');
      console.log('========================================\n');

      // 阶段1: 创建销售订单
      await this.phase1_CreateSalesOrder();

      // 阶段2: 创建生产订单
      const productionOrder = await this.phase2_CreateProductionOrder();

      // 阶段3: 设计和修改BOM
      await this.phase3_DesignAndModifyBOM();

      // 阶段4: 创建采购订单
      await this.phase4_CreatePurchaseOrder();

      // 阶段5: 执行生产
      const workOrder = await this.phase5_ExecuteProduction(productionOrder);

      // 阶段6: 质量检测
      await this.phase6_QualityInspection(workOrder);

      // 阶段7: 发货
      await this.phase7_Shipping();

      this.executionReport.status = 'completed';
      this.executionReport.endTime = new Date();

      console.log('\n========================================');
      console.log('端到端工作流执行完成');
      console.log('========================================\n');

      return this.executionReport;
    } catch (error) {
      this.executionReport.status = 'failed';
      this.executionReport.endTime = new Date();
      this.logExecution(
        'workflow',
        'Lead Agent',
        '执行工作流',
        'error',
        undefined,
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * 阶段1: 创建销售订单
   */
  private async phase1_CreateSalesOrder(): Promise<void> {
    try {
      const salesOrder = await this.erp.createSalesOrder(
        '客户A',
        'PROD-VORTEX-001',
        10
      );

      this.logExecution(
        '阶段1',
        'ERP Agent',
        '创建销售订单',
        'success',
        {
          orderId: salesOrder.orderId,
          quantity: salesOrder.quantity,
          totalPrice: salesOrder.totalPrice,
        }
      );

      // 确认销售订单
      await this.erp.confirmSalesOrder(salesOrder.orderId);
      this.logExecution(
        '阶段1',
        'ERP Agent',
        '确认销售订单',
        'success',
        { orderId: salesOrder.orderId }
      );
    } catch (error) {
      this.logExecution(
        '阶段1',
        'ERP Agent',
        '创建销售订单',
        'error',
        undefined,
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * 阶段2: 创建生产订单
   */
  private async phase2_CreateProductionOrder(): Promise<any> {
    try {
      const productionOrder = await this.erp.createProductionOrder(
        'PROD-VORTEX-001',
        10,
        'V1.0'
      );

      this.logExecution(
        '阶段2',
        'ERP Agent',
        '创建生产订单',
        'success',
        {
          poId: productionOrder.poId,
          quantity: productionOrder.quantity,
        }
      );

      return productionOrder;
    } catch (error) {
      this.logExecution(
        '阶段2',
        'ERP Agent',
        '创建生产订单',
        'error',
        undefined,
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * 阶段3: 设计和修改BOM
   * 特别是修改机油物料号
   */
  private async phase3_DesignAndModifyBOM(): Promise<void> {
    try {
      // 获取原始BOM
      const bom = await this.plm.getBOM('BOM-VORTEX-001');
      if (!bom) {
        throw new Error('BOM not found');
      }

      this.logExecution(
        '阶段3',
        'PLM Agent',
        '获取BOM',
        'success',
        { bomId: bom.bomId, itemCount: bom.items.length }
      );

      // 查找机油物料项
      const oilItem = bom.items.find(item => item.materialId === 'MAT-OIL-001');
      if (!oilItem) {
        throw new Error('Oil item not found in BOM');
      }

      this.logExecution(
        '阶段3',
        'PLM Agent',
        '查找机油物料',
        'success',
        {
          itemId: oilItem.itemId,
          materialId: oilItem.materialId,
          materialName: oilItem.materialName,
          quantity: oilItem.quantity,
        }
      );

      // 修改机油物料号
      // 注：这里模拟修改为新的机油物料号
      // 在实际场景中，可能是因为供应商变更或产品升级
      const newOilMaterialId = 'MAT-OIL-002'; // 新的机油物料号
      const newOilMaterialName = '高性能冷冻油';

      await this.plm.modifyBOMItem(
        bom.bomId,
        oilItem.itemId,
        newOilMaterialId,
        newOilMaterialName,
        3 // 新的数量
      );

      this.logExecution(
        '阶段3',
        'PLM Agent',
        '修改BOM物料（机油）',
        'success',
        {
          bomId: bom.bomId,
          itemId: oilItem.itemId,
          oldMaterialId: 'MAT-OIL-001',
          newMaterialId: newOilMaterialId,
          newQuantity: 3,
        }
      );

      // 修改其他物料号以满足新订单需求
      // 例如：更新电机型号
      const motorItem = bom.items.find(item => item.materialId === 'MAT-MOTOR-001');
      if (motorItem) {
        await this.plm.modifyBOMItem(
          bom.bomId,
          motorItem.itemId,
          'MAT-MOTOR-002', // 新的电机型号
          '高效电机',
          1
        );

        this.logExecution(
          '阶段3',
          'PLM Agent',
          '修改BOM物料（电机）',
          'success',
          {
            bomId: bom.bomId,
            itemId: motorItem.itemId,
            oldMaterialId: 'MAT-MOTOR-001',
            newMaterialId: 'MAT-MOTOR-002',
          }
        );
      }

      // 发布修改后的BOM
      await this.plm.releaseBOM(bom.bomId);
      this.logExecution(
        '阶段3',
        'PLM Agent',
        '发布修改后的BOM',
        'success',
        { bomId: bom.bomId }
      );
    } catch (error) {
      this.logExecution(
        '阶段3',
        'PLM Agent',
        '设计和修改BOM',
        'error',
        undefined,
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * 阶段4: 创建采购订单
   */
  private async phase4_CreatePurchaseOrder(): Promise<void> {
    try {
      // 根据修改后的BOM创建采购订单
      const purchaseOrder = await this.erp.createPurchaseOrder('SUP-001', [
        { materialId: 'MAT-MOTOR-002', quantity: 10 },
        { materialId: 'MAT-OIL-002', quantity: 30 },
        { materialId: 'MAT-ROTOR-001', quantity: 10 },
        { materialId: 'MAT-STATOR-001', quantity: 10 },
        { materialId: 'MAT-HOUSING-001', quantity: 10 },
        { materialId: 'MAT-BEARING-001', quantity: 20 },
      ]);

      this.logExecution(
        '阶段4',
        'ERP Agent',
        '创建采购订单',
        'success',
        {
          poId: purchaseOrder.poId,
          itemCount: purchaseOrder.items.length,
          totalAmount: purchaseOrder.totalAmount,
        }
      );
    } catch (error) {
      this.logExecution(
        '阶段4',
        'ERP Agent',
        '创建采购订单',
        'error',
        undefined,
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * 阶段5: 执行生产
   */
  private async phase5_ExecuteProduction(productionOrder: any): Promise<any> {
    try {
      // 创建工作订单
      const workOrder = await this.mes.createWorkOrder(
        productionOrder.poId,
        productionOrder.productId,
        productionOrder.productName,
        productionOrder.quantity,
        productionOrder.bomVersion
      );

      this.logExecution(
        '阶段5',
        'MES Agent',
        '创建工作订单',
        'success',
        { workOrderId: workOrder.workOrderId, quantity: workOrder.quantity }
      );

      // 安排工作订单
      await this.mes.scheduleWorkOrder(workOrder.workOrderId);
      this.logExecution(
        '阶段5',
        'MES Agent',
        '安排工作订单',
        'success',
        { workOrderId: workOrder.workOrderId }
      );

      // 开始生产
      await this.mes.startWorkOrder(workOrder.workOrderId);
      this.logExecution(
        '阶段5',
        'MES Agent',
        '开始生产',
        'success',
        { workOrderId: workOrder.workOrderId }
      );

      // 创建和执行生产任务
      const tasks = [
        { name: '组装电机', duration: 30 },
        { name: '安装转子', duration: 20 },
        { name: '安装定子', duration: 20 },
        { name: '加注冷冻油', duration: 15 },
        { name: '安装外壳', duration: 25 },
        { name: '安装轴承', duration: 20 },
        { name: '最终组装', duration: 30 },
      ];

      for (let i = 0; i < tasks.length; i++) {
        const task = await this.mes.createProductionTask(
          workOrder.workOrderId,
          tasks[i].name,
          i + 1,
          tasks[i].duration
        );

        await this.mes.executeProductionTask(task.taskId);

        this.logExecution(
          '阶段5',
          'MES Agent',
          `执行生产任务: ${tasks[i].name}`,
          'success',
          { taskId: task.taskId }
        );
      }

      // 完成生产
      await this.mes.completeWorkOrder(workOrder.workOrderId);
      this.logExecution(
        '阶段5',
        'MES Agent',
        '完成生产',
        'success',
        { workOrderId: workOrder.workOrderId }
      );

      return workOrder;
    } catch (error) {
      this.logExecution(
        '阶段5',
        'MES Agent',
        '执行生产',
        'error',
        undefined,
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * 阶段6: 质量检测
   */
  private async phase6_QualityInspection(workOrder: any): Promise<void> {
    try {
      // 创建进货检测
      const incomingInspection = await this.mes.createQualityInspection(
        workOrder.workOrderId,
        'incoming'
      );

      await this.mes.completeQualityInspection(
        incomingInspection.inspectionId,
        'pass',
        '原材料符合规格'
      );

      this.logExecution(
        '阶段6',
        'MES Agent',
        '进货检测',
        'success',
        { inspectionId: incomingInspection.inspectionId, result: 'pass' }
      );

      // 创建过程检测
      const inProcessInspection = await this.mes.createQualityInspection(
        workOrder.workOrderId,
        'in_process'
      );

      await this.mes.completeQualityInspection(
        inProcessInspection.inspectionId,
        'pass',
        '生产过程符合标准'
      );

      this.logExecution(
        '阶段6',
        'MES Agent',
        '过程检测',
        'success',
        { inspectionId: inProcessInspection.inspectionId, result: 'pass' }
      );

      // 创建最终检测
      const finalInspection = await this.mes.createQualityInspection(
        workOrder.workOrderId,
        'final'
      );

      await this.mes.completeQualityInspection(
        finalInspection.inspectionId,
        'pass',
        '产品符合质量标准'
      );

      this.logExecution(
        '阶段6',
        'MES Agent',
        '最终检测',
        'success',
        { inspectionId: finalInspection.inspectionId, result: 'pass' }
      );
    } catch (error) {
      this.logExecution(
        '阶段6',
        'MES Agent',
        '质量检测',
        'error',
        undefined,
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * 阶段7: 发货
   */
  private async phase7_Shipping(): Promise<void> {
    try {
      // 创建发货单
      const shippingOrder = await this.warehouse.createShippingOrder(
        'SO-001',
        'PROD-VORTEX-001',
        '涡旋压缩机',
        10,
        '客户A'
      );

      this.logExecution(
        '阶段7',
        '仓库 Agent',
        '创建发货单',
        'success',
        { shippingOrderId: shippingOrder.shippingOrderId, quantity: shippingOrder.quantity }
      );

      // 开始拣货
      await this.warehouse.startPicking(shippingOrder.shippingOrderId);
      this.logExecution(
        '阶段7',
        '仓库 Agent',
        '开始拣货',
        'success',
        { shippingOrderId: shippingOrder.shippingOrderId }
      );

      // 完成拣货
      await this.warehouse.completePicking(shippingOrder.shippingOrderId);
      this.logExecution(
        '阶段7',
        '仓库 Agent',
        '完成拣货',
        'success',
        { shippingOrderId: shippingOrder.shippingOrderId }
      );

      // 发货
      await this.warehouse.shipOrder(shippingOrder.shippingOrderId);
      this.logExecution(
        '阶段7',
        '仓库 Agent',
        '发货',
        'success',
        { shippingOrderId: shippingOrder.shippingOrderId }
      );

      // 确认送达
      await this.warehouse.confirmDelivery(shippingOrder.shippingOrderId);
      this.logExecution(
        '阶段7',
        '仓库 Agent',
        '确认送达',
        'success',
        { shippingOrderId: shippingOrder.shippingOrderId }
      );
    } catch (error) {
      this.logExecution(
        '阶段7',
        '仓库 Agent',
        '发货',
        'error',
        undefined,
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * 获取执行报告
   */
  getExecutionReport(): WorkflowExecutionReport {
    if (this.executionReport.endTime && this.executionReport.startTime) {
      this.executionReport.summary.duration =
        this.executionReport.endTime.getTime() - this.executionReport.startTime.getTime();
    }
    return this.executionReport;
  }
}
