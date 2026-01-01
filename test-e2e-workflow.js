// ERP系统
class ERPSystem {
  constructor() {
    this.salesOrders = new Map();
    this.purchaseOrders = new Map();
    this.productionOrders = new Map();
    this.products = new Map();
    this.materials = new Map();
    this.initializeProducts();
    this.initializeMaterials();
  }

  initializeProducts() {
    this.products.set('PROD-VORTEX-001', {
      productId: 'PROD-VORTEX-001',
      productName: '涡旋压缩机',
      unitPrice: 5000,
    });
  }

  initializeMaterials() {
    const materials = [
      { materialId: 'MAT-MOTOR-001', materialName: '电机', unitPrice: 800 },
      { materialId: 'MAT-ROTOR-001', materialName: '转子', unitPrice: 600 },
      { materialId: 'MAT-STATOR-001', materialName: '定子', unitPrice: 500 },
      { materialId: 'MAT-OIL-001', materialName: '冷冻油', unitPrice: 100 },
      { materialId: 'MAT-HOUSING-001', materialName: '外壳', unitPrice: 300 },
      { materialId: 'MAT-BEARING-001', materialName: '轴承', unitPrice: 200 },
    ];
    materials.forEach(mat => this.materials.set(mat.materialId, mat));
  }

  async createSalesOrder(customerName, productId, quantity) {
    const product = this.products.get(productId);
    const orderId = `SO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const salesOrder = {
      orderId,
      customerName,
      productId,
      productName: product.productName,
      quantity,
      unitPrice: product.unitPrice,
      totalPrice: product.unitPrice * quantity,
      status: 'pending',
    };
    this.salesOrders.set(orderId, salesOrder);
    console.log(`✓ ERP: 创建销售订单 ${orderId}`);
    return salesOrder;
  }

  async confirmSalesOrder(orderId) {
    const order = this.salesOrders.get(orderId);
    order.status = 'confirmed';
    console.log(`✓ ERP: 确认销售订单 ${orderId}`);
    return order;
  }

  async createProductionOrder(productId, quantity, bomVersion) {
    const product = this.products.get(productId);
    const poId = `PO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const productionOrder = {
      poId,
      productId,
      productName: product.productName,
      quantity,
      bomVersion,
      status: 'draft',
    };
    this.productionOrders.set(poId, productionOrder);
    console.log(`✓ ERP: 创建生产订单 ${poId}`);
    return productionOrder;
  }

  async createPurchaseOrder(supplierId, items) {
    let totalAmount = 0;
    const poItems = [];
    for (const item of items) {
      // 如果物料不存在，创建一个默认物料
      let material = this.materials.get(item.materialId);
      if (!material) {
        material = {
          materialId: item.materialId,
          materialName: `物料-${item.materialId}`,
          unitPrice: 100,
        };
        this.materials.set(item.materialId, material);
      }
      const itemTotal = material.unitPrice * item.quantity;
      totalAmount += itemTotal;
      poItems.push({
        materialId: item.materialId,
        materialName: material.materialName,
        quantity: item.quantity,
      });
    }
    const poId = `PO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`✓ ERP: 创建采购订单 ${poId}`);
    return { poId, items: poItems, totalAmount };
  }
}

// PLM系统
class PLMSystem {
  constructor() {
    this.boms = new Map();
    this.initializeBOMs();
  }

  initializeBOMs() {
    const vortexBOM = {
      bomId: 'BOM-VORTEX-001',
      productId: 'PROD-VORTEX-001',
      productName: '涡旋压缩机',
      version: 'V1.0',
      items: [
        { itemId: 'ITEM-001', materialId: 'MAT-MOTOR-001', materialName: '电机', quantity: 1 },
        { itemId: 'ITEM-002', materialId: 'MAT-ROTOR-001', materialName: '转子', quantity: 1 },
        { itemId: 'ITEM-003', materialId: 'MAT-STATOR-001', materialName: '定子', quantity: 1 },
        { itemId: 'ITEM-004', materialId: 'MAT-OIL-001', materialName: '冷冻油', quantity: 2 },
        { itemId: 'ITEM-005', materialId: 'MAT-HOUSING-001', materialName: '外壳', quantity: 1 },
        { itemId: 'ITEM-006', materialId: 'MAT-BEARING-001', materialName: '轴承', quantity: 2 },
      ],
    };
    this.boms.set(vortexBOM.bomId, vortexBOM);
  }

  async getBOM(bomId) {
    return this.boms.get(bomId);
  }

  async modifyBOMItem(bomId, itemId, newMaterialId, newMaterialName, newQuantity) {
    const bom = this.boms.get(bomId);
    const item = bom.items.find(i => i.itemId === itemId);
    const oldMaterialId = item.materialId;
    item.materialId = newMaterialId;
    item.materialName = newMaterialName;
    if (newQuantity) item.quantity = newQuantity;
    console.log(`✓ PLM: 修改BOM物料 ${itemId}: ${oldMaterialId} -> ${newMaterialId}`);
    return bom;
  }

  async releaseBOM(bomId) {
    const bom = this.boms.get(bomId);
    bom.status = 'released';
    console.log(`✓ PLM: 发布BOM ${bomId}`);
    return bom;
  }
}

// MES系统
class MESSystem {
  constructor() {
    this.workOrders = new Map();
    this.productionTasks = new Map();
    this.qualityInspections = new Map();
  }

  async createWorkOrder(productionOrderId, productId, productName, quantity, bomVersion) {
    const workOrderId = `WO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const workOrder = { workOrderId, productionOrderId, productId, productName, quantity, bomVersion, status: 'pending' };
    this.workOrders.set(workOrderId, workOrder);
    console.log(`✓ MES: 创建工作订单 ${workOrderId}`);
    return workOrder;
  }

  async scheduleWorkOrder(workOrderId) {
    const workOrder = this.workOrders.get(workOrderId);
    workOrder.status = 'scheduled';
    console.log(`✓ MES: 安排工作订单 ${workOrderId}`);
    return workOrder;
  }

  async startWorkOrder(workOrderId) {
    const workOrder = this.workOrders.get(workOrderId);
    workOrder.status = 'in_progress';
    console.log(`✓ MES: 开始工作订单 ${workOrderId}`);
    return workOrder;
  }

  async createProductionTask(workOrderId, taskName, sequence) {
    const taskId = `TASK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const task = { taskId, workOrderId, taskName, sequence, status: 'pending' };
    this.productionTasks.set(taskId, task);
    console.log(`✓ MES: 创建生产任务 ${taskId} (${taskName})`);
    return task;
  }

  async executeProductionTask(taskId) {
    const task = this.productionTasks.get(taskId);
    task.status = 'completed';
    console.log(`✓ MES: 完成生产任务 ${taskId}`);
    return task;
  }

  async completeWorkOrder(workOrderId) {
    const workOrder = this.workOrders.get(workOrderId);
    workOrder.status = 'completed';
    console.log(`✓ MES: 完成工作订单 ${workOrderId}`);
    return workOrder;
  }

  async createQualityInspection(workOrderId, inspectionType) {
    const inspectionId = `QI-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const inspection = { inspectionId, workOrderId, inspectionType, result: 'pending' };
    this.qualityInspections.set(inspectionId, inspection);
    console.log(`✓ MES: 创建质量检测 ${inspectionId} (${inspectionType})`);
    return inspection;
  }

  async completeQualityInspection(inspectionId, result, notes) {
    const inspection = this.qualityInspections.get(inspectionId);
    inspection.result = result;
    inspection.notes = notes;
    console.log(`✓ MES: 完成质量检测 ${inspectionId} - ${result}`);
    return inspection;
  }
}

// 仓库系统
class WarehouseSystem {
  constructor() {
    this.shippingOrders = new Map();
  }

  async createShippingOrder(salesOrderId, productId, productName, quantity, customerName) {
    const shippingOrderId = `SO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const shippingOrder = { shippingOrderId, salesOrderId, productId, productName, quantity, customerName, status: 'pending' };
    this.shippingOrders.set(shippingOrderId, shippingOrder);
    console.log(`✓ 仓库: 创建发货单 ${shippingOrderId}`);
    return shippingOrder;
  }

  async startPicking(shippingOrderId) {
    const order = this.shippingOrders.get(shippingOrderId);
    order.status = 'picking';
    console.log(`✓ 仓库: 开始拣货 ${shippingOrderId}`);
    return order;
  }

  async completePicking(shippingOrderId) {
    const order = this.shippingOrders.get(shippingOrderId);
    order.status = 'packed';
    console.log(`✓ 仓库: 完成拣货 ${shippingOrderId}`);
    return order;
  }

  async shipOrder(shippingOrderId) {
    const order = this.shippingOrders.get(shippingOrderId);
    order.status = 'shipped';
    order.trackingNumber = `TRK-${Date.now()}`;
    console.log(`✓ 仓库: 发货 ${shippingOrderId} (追踪号: ${order.trackingNumber})`);
    return order;
  }

  async confirmDelivery(shippingOrderId) {
    const order = this.shippingOrders.get(shippingOrderId);
    order.status = 'delivered';
    console.log(`✓ 仓库: 确认送达 ${shippingOrderId}`);
    return order;
  }
}

// 主函数
async function main() {
  console.log('\n========================================');
  console.log('开始执行端到端工业流程工作流');
  console.log('========================================\n');

  const startTime = Date.now();

  try {
    const erp = new ERPSystem();
    const plm = new PLMSystem();
    const mes = new MESSystem();
    const warehouse = new WarehouseSystem();

    console.log('\n--- 阶段1: 销售订单 (ERP) ---');
    const salesOrder = await erp.createSalesOrder('客户A', 'PROD-VORTEX-001', 10);
    await erp.confirmSalesOrder(salesOrder.orderId);

    console.log('\n--- 阶段2: 生产订单 (ERP) ---');
    const productionOrder = await erp.createProductionOrder('PROD-VORTEX-001', 10, 'V1.0');

    console.log('\n--- 阶段3: 设计和修改BOM (PLM) ---');
    const bom = await plm.getBOM('BOM-VORTEX-001');
    const oilItem = bom.items.find(i => i.materialId === 'MAT-OIL-001');
    await plm.modifyBOMItem(bom.bomId, oilItem.itemId, 'MAT-OIL-002', '高性能冷冻油', 3);
    const motorItem = bom.items.find(i => i.materialId === 'MAT-MOTOR-001');
    await plm.modifyBOMItem(bom.bomId, motorItem.itemId, 'MAT-MOTOR-002', '高效电机', 1);
    await plm.releaseBOM(bom.bomId);

    console.log('\n--- 阶段4: 采购订单 (ERP) ---');
    await erp.createPurchaseOrder('SUP-001', [
      { materialId: 'MAT-MOTOR-002', quantity: 10 },
      { materialId: 'MAT-OIL-002', quantity: 30 },
      { materialId: 'MAT-ROTOR-001', quantity: 10 },
      { materialId: 'MAT-STATOR-001', quantity: 10 },
      { materialId: 'MAT-HOUSING-001', quantity: 10 },
      { materialId: 'MAT-BEARING-001', quantity: 20 },
    ]);

    console.log('\n--- 阶段5: 生产执行 (MES) ---');
    const workOrder = await mes.createWorkOrder(productionOrder.poId, productionOrder.productId, productionOrder.productName, productionOrder.quantity, productionOrder.bomVersion);
    await mes.scheduleWorkOrder(workOrder.workOrderId);
    await mes.startWorkOrder(workOrder.workOrderId);

    const tasks = [
      '组装电机', '安装转子', '安装定子', '加注冷冻油', '安装外壳', '安装轴承', '最终组装'
    ];

    for (let i = 0; i < tasks.length; i++) {
      const task = await mes.createProductionTask(workOrder.workOrderId, tasks[i], i + 1);
      await mes.executeProductionTask(task.taskId);
    }

    await mes.completeWorkOrder(workOrder.workOrderId);

    console.log('\n--- 阶段6: 质量检测 (MES) ---');
    const incomingInspection = await mes.createQualityInspection(workOrder.workOrderId, 'incoming');
    await mes.completeQualityInspection(incomingInspection.inspectionId, 'pass', '原材料符合规格');

    const inProcessInspection = await mes.createQualityInspection(workOrder.workOrderId, 'in_process');
    await mes.completeQualityInspection(inProcessInspection.inspectionId, 'pass', '生产过程符合标准');

    const finalInspection = await mes.createQualityInspection(workOrder.workOrderId, 'final');
    await mes.completeQualityInspection(finalInspection.inspectionId, 'pass', '产品符合质量标准');

    console.log('\n--- 阶段7: 发货 (仓库) ---');
    const shippingOrder = await warehouse.createShippingOrder('SO-001', 'PROD-VORTEX-001', '涡旋压缩机', 10, '客户A');
    await warehouse.startPicking(shippingOrder.shippingOrderId);
    await warehouse.completePicking(shippingOrder.shippingOrderId);
    await warehouse.shipOrder(shippingOrder.shippingOrderId);
    await warehouse.confirmDelivery(shippingOrder.shippingOrderId);

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log('\n========================================');
    console.log('端到端工作流执行完成');
    console.log('========================================');
    console.log(`执行时间: ${duration.toFixed(2)}秒`);
    console.log('========================================\n');

  } catch (error) {
    console.error('工作流执行失败:', error);
    process.exit(1);
  }
}

main().catch(console.error);
