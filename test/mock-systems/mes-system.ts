/**
 * 模拟MES系统
 * 负责生产计划、生产执行、质量检测等功能
 */

export interface WorkOrder {
  workOrderId: string;
  productionOrderId: string;
  productId: string;
  productName: string;
  quantity: number;
  bomVersion: string;
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  createdAt: Date;
}

export interface ProductionTask {
  taskId: string;
  workOrderId: string;
  taskName: string;
  sequence: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  duration?: number; // 分钟
  createdAt: Date;
}

export interface QualityInspection {
  inspectionId: string;
  workOrderId: string;
  inspectionType: 'incoming' | 'in_process' | 'final';
  result: 'pass' | 'fail' | 'pending';
  notes?: string;
  inspectedAt?: Date;
  createdAt: Date;
}

export interface ProductionLog {
  logId: string;
  workOrderId: string;
  taskId?: string;
  eventType: string;
  message: string;
  timestamp: Date;
}

export class MESSystem {
  private workOrders: Map<string, WorkOrder> = new Map();
  private productionTasks: Map<string, ProductionTask> = new Map();
  private qualityInspections: Map<string, QualityInspection> = new Map();
  private productionLogs: ProductionLog[] = [];

  /**
   * 创建工作订单
   */
  async createWorkOrder(
    productionOrderId: string,
    productId: string,
    productName: string,
    quantity: number,
    bomVersion: string
  ): Promise<WorkOrder> {
    const workOrderId = `WO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const workOrder: WorkOrder = {
      workOrderId,
      productionOrderId,
      productId,
      productName,
      quantity,
      bomVersion,
      status: 'pending',
      createdAt: new Date(),
    };

    this.workOrders.set(workOrderId, workOrder);
    await this.logEvent(workOrderId, 'work_order_created', `创建工作订单 ${workOrderId}`);
    console.log(`✓ MES: 创建工作订单 ${workOrderId}`);
    return workOrder;
  }

  /**
   * 获取工作订单
   */
  async getWorkOrder(workOrderId: string): Promise<WorkOrder | null> {
    return this.workOrders.get(workOrderId) || null;
  }

  /**
   * 安排工作订单
   */
  async scheduleWorkOrder(workOrderId: string): Promise<WorkOrder> {
    const workOrder = this.workOrders.get(workOrderId);
    if (!workOrder) {
      throw new Error(`Work order ${workOrderId} not found`);
    }

    workOrder.status = 'scheduled';
    await this.logEvent(workOrderId, 'work_order_scheduled', `安排工作订单 ${workOrderId}`);
    console.log(`✓ MES: 安排工作订单 ${workOrderId}`);
    return workOrder;
  }

  /**
   * 开始工作订单
   */
  async startWorkOrder(workOrderId: string): Promise<WorkOrder> {
    const workOrder = this.workOrders.get(workOrderId);
    if (!workOrder) {
      throw new Error(`Work order ${workOrderId} not found`);
    }

    workOrder.status = 'in_progress';
    workOrder.startTime = new Date();
    await this.logEvent(workOrderId, 'work_order_started', `开始工作订单 ${workOrderId}`);
    console.log(`✓ MES: 开始工作订单 ${workOrderId}`);
    return workOrder;
  }

  /**
   * 创建生产任务
   */
  async createProductionTask(
    workOrderId: string,
    taskName: string,
    sequence: number,
    durationMinutes: number = 30
  ): Promise<ProductionTask> {
    const taskId = `TASK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const task: ProductionTask = {
      taskId,
      workOrderId,
      taskName,
      sequence,
      status: 'pending',
      duration: durationMinutes,
      createdAt: new Date(),
    };

    this.productionTasks.set(taskId, task);
    await this.logEvent(workOrderId, 'task_created', `创建生产任务 ${taskName}`);
    console.log(`✓ MES: 创建生产任务 ${taskId} (${taskName})`);
    return task;
  }

  /**
   * 执行生产任务
   */
  async executeProductionTask(taskId: string): Promise<ProductionTask> {
    const task = this.productionTasks.get(taskId);
    if (!task) {
      throw new Error(`Production task ${taskId} not found`);
    }

    task.status = 'in_progress';
    task.startTime = new Date();

    await this.logEvent(
      task.workOrderId,
      'task_started',
      `开始执行任务 ${task.taskName}`
    );

    // 模拟任务执行
    const duration = task.duration || 30;
    await new Promise(resolve => setTimeout(resolve, Math.min(duration * 10, 2000))); // 加速执行

    task.status = 'completed';
    task.endTime = new Date();

    await this.logEvent(
      task.workOrderId,
      'task_completed',
      `完成任务 ${task.taskName}`
    );

    console.log(`✓ MES: 完成生产任务 ${taskId}`);
    return task;
  }

  /**
   * 完成工作订单
   */
  async completeWorkOrder(workOrderId: string): Promise<WorkOrder> {
    const workOrder = this.workOrders.get(workOrderId);
    if (!workOrder) {
      throw new Error(`Work order ${workOrderId} not found`);
    }

    workOrder.status = 'completed';
    workOrder.endTime = new Date();

    await this.logEvent(workOrderId, 'work_order_completed', `完成工作订单 ${workOrderId}`);
    console.log(`✓ MES: 完成工作订单 ${workOrderId}`);
    return workOrder;
  }

  /**
   * 创建质量检测
   */
  async createQualityInspection(
    workOrderId: string,
    inspectionType: 'incoming' | 'in_process' | 'final'
  ): Promise<QualityInspection> {
    const inspectionId = `QI-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const inspection: QualityInspection = {
      inspectionId,
      workOrderId,
      inspectionType,
      result: 'pending',
      createdAt: new Date(),
    };

    this.qualityInspections.set(inspectionId, inspection);
    await this.logEvent(workOrderId, 'inspection_created', `创建${inspectionType}质量检测`);
    console.log(`✓ MES: 创建质量检测 ${inspectionId} (${inspectionType})`);
    return inspection;
  }

  /**
   * 完成质量检测
   */
  async completeQualityInspection(
    inspectionId: string,
    result: 'pass' | 'fail',
    notes?: string
  ): Promise<QualityInspection> {
    const inspection = this.qualityInspections.get(inspectionId);
    if (!inspection) {
      throw new Error(`Quality inspection ${inspectionId} not found`);
    }

    inspection.result = result;
    inspection.notes = notes;
    inspection.inspectedAt = new Date();

    await this.logEvent(
      inspection.workOrderId,
      'inspection_completed',
      `质量检测结果: ${result}${notes ? ` (${notes})` : ''}`
    );

    console.log(`✓ MES: 完成质量检测 ${inspectionId} - ${result}`);
    return inspection;
  }

  /**
   * 获取工作订单的所有任务
   */
  async getWorkOrderTasks(workOrderId: string): Promise<ProductionTask[]> {
    return Array.from(this.productionTasks.values()).filter(
      task => task.workOrderId === workOrderId
    );
  }

  /**
   * 获取工作订单的所有质量检测
   */
  async getWorkOrderInspections(workOrderId: string): Promise<QualityInspection[]> {
    return Array.from(this.qualityInspections.values()).filter(
      inspection => inspection.workOrderId === workOrderId
    );
  }

  /**
   * 记录生产日志
   */
  private async logEvent(
    workOrderId: string,
    eventType: string,
    message: string
  ): Promise<void> {
    const log: ProductionLog = {
      logId: `LOG-${Date.now()}`,
      workOrderId,
      eventType,
      message,
      timestamp: new Date(),
    };

    this.productionLogs.push(log);
  }

  /**
   * 获取工作订单的生产日志
   */
  async getProductionLogs(workOrderId: string): Promise<ProductionLog[]> {
    return this.productionLogs.filter(log => log.workOrderId === workOrderId);
  }

  /**
   * 获取所有生产日志
   */
  async getAllProductionLogs(): Promise<ProductionLog[]> {
    return this.productionLogs;
  }
}

export const mesSystem = new MESSystem();
