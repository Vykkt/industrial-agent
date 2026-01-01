/**
 * 模拟仓库系统
 * 负责库存管理、出库、发货等功能
 */

export interface InventoryItem {
  itemId: string;
  materialId: string;
  materialName: string;
  quantity: number;
  warehouseLocation: string;
  lastUpdated: Date;
}

export interface ShippingOrder {
  shippingOrderId: string;
  salesOrderId: string;
  productId: string;
  productName: string;
  quantity: number;
  customerName: string;
  status: 'pending' | 'picking' | 'packed' | 'shipped' | 'delivered';
  pickingTime?: Date;
  packingTime?: Date;
  shippingTime?: Date;
  deliveryTime?: Date;
  trackingNumber?: string;
  createdAt: Date;
}

export interface WarehouseLog {
  logId: string;
  eventType: string;
  materialId?: string;
  quantity?: number;
  message: string;
  timestamp: Date;
}

export class WarehouseSystem {
  private inventory: Map<string, InventoryItem> = new Map();
  private shippingOrders: Map<string, ShippingOrder> = new Map();
  private warehouseLogs: WarehouseLog[] = [];

  constructor() {
    this.initializeInventory();
  }

  /**
   * 初始化库存
   */
  private initializeInventory(): void {
    const materials = [
      {
        materialId: 'MAT-MOTOR-001',
        materialName: '电机',
        quantity: 100,
        location: 'A-01-01',
      },
      {
        materialId: 'MAT-ROTOR-001',
        materialName: '转子',
        quantity: 150,
        location: 'A-01-02',
      },
      {
        materialId: 'MAT-STATOR-001',
        materialName: '定子',
        quantity: 120,
        location: 'A-01-03',
      },
      {
        materialId: 'MAT-OIL-001',
        materialName: '冷冻油',
        quantity: 500,
        location: 'B-01-01',
      },
      {
        materialId: 'MAT-HOUSING-001',
        materialName: '外壳',
        quantity: 80,
        location: 'A-02-01',
      },
      {
        materialId: 'MAT-BEARING-001',
        materialName: '轴承',
        quantity: 200,
        location: 'A-02-02',
      },
    ];

    materials.forEach((mat, index) => {
      const item: InventoryItem = {
        itemId: `INV-${index + 1}`,
        materialId: mat.materialId,
        materialName: mat.materialName,
        quantity: mat.quantity,
        warehouseLocation: mat.location,
        lastUpdated: new Date(),
      };

      this.inventory.set(mat.materialId, item);
    });

    console.log(`✓ 仓库: 初始化库存 ${this.inventory.size} 种物料`);
  }

  /**
   * 获取库存
   */
  async getInventory(materialId: string): Promise<InventoryItem | null> {
    return this.inventory.get(materialId) || null;
  }

  /**
   * 获取所有库存
   */
  async getAllInventory(): Promise<InventoryItem[]> {
    return Array.from(this.inventory.values());
  }

  /**
   * 更新库存
   */
  async updateInventory(
    materialId: string,
    quantityChange: number,
    reason: string
  ): Promise<InventoryItem> {
    const item = this.inventory.get(materialId);
    if (!item) {
      throw new Error(`Material ${materialId} not found in inventory`);
    }

    const oldQuantity = item.quantity;
    item.quantity += quantityChange;
    item.lastUpdated = new Date();

    await this.logEvent(
      'inventory_updated',
      materialId,
      quantityChange,
      `库存变化: ${oldQuantity} -> ${item.quantity} (${reason})`
    );

    console.log(
      `✓ 仓库: 更新库存 ${materialId} ${quantityChange > 0 ? '+' : ''}${quantityChange}`
    );
    return item;
  }

  /**
   * 创建发货单
   */
  async createShippingOrder(
    salesOrderId: string,
    productId: string,
    productName: string,
    quantity: number,
    customerName: string
  ): Promise<ShippingOrder> {
    const shippingOrderId = `SO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const shippingOrder: ShippingOrder = {
      shippingOrderId,
      salesOrderId,
      productId,
      productName,
      quantity,
      customerName,
      status: 'pending',
      createdAt: new Date(),
    };

    this.shippingOrders.set(shippingOrderId, shippingOrder);
    await this.logEvent('shipping_order_created', undefined, undefined, `创建发货单 ${shippingOrderId}`);
    console.log(`✓ 仓库: 创建发货单 ${shippingOrderId}`);
    return shippingOrder;
  }

  /**
   * 获取发货单
   */
  async getShippingOrder(shippingOrderId: string): Promise<ShippingOrder | null> {
    return this.shippingOrders.get(shippingOrderId) || null;
  }

  /**
   * 开始拣货
   */
  async startPicking(shippingOrderId: string): Promise<ShippingOrder> {
    const order = this.shippingOrders.get(shippingOrderId);
    if (!order) {
      throw new Error(`Shipping order ${shippingOrderId} not found`);
    }

    order.status = 'picking';
    order.pickingTime = new Date();

    await this.logEvent('picking_started', undefined, undefined, `开始拣货 ${shippingOrderId}`);
    console.log(`✓ 仓库: 开始拣货 ${shippingOrderId}`);
    return order;
  }

  /**
   * 完成拣货
   */
  async completePicking(shippingOrderId: string): Promise<ShippingOrder> {
    const order = this.shippingOrders.get(shippingOrderId);
    if (!order) {
      throw new Error(`Shipping order ${shippingOrderId} not found`);
    }

    order.status = 'packed';
    order.packingTime = new Date();

    await this.logEvent('picking_completed', undefined, undefined, `完成拣货 ${shippingOrderId}`);
    console.log(`✓ 仓库: 完成拣货 ${shippingOrderId}`);
    return order;
  }

  /**
   * 发货
   */
  async shipOrder(shippingOrderId: string): Promise<ShippingOrder> {
    const order = this.shippingOrders.get(shippingOrderId);
    if (!order) {
      throw new Error(`Shipping order ${shippingOrderId} not found`);
    }

    order.status = 'shipped';
    order.shippingTime = new Date();
    order.trackingNumber = `TRK-${Date.now()}`;

    await this.logEvent(
      'order_shipped',
      undefined,
      undefined,
      `发货 ${shippingOrderId} - 追踪号: ${order.trackingNumber}`
    );

    console.log(`✓ 仓库: 发货 ${shippingOrderId} (追踪号: ${order.trackingNumber})`);
    return order;
  }

  /**
   * 确认送达
   */
  async confirmDelivery(shippingOrderId: string): Promise<ShippingOrder> {
    const order = this.shippingOrders.get(shippingOrderId);
    if (!order) {
      throw new Error(`Shipping order ${shippingOrderId} not found`);
    }

    order.status = 'delivered';
    order.deliveryTime = new Date();

    await this.logEvent(
      'order_delivered',
      undefined,
      undefined,
      `确认送达 ${shippingOrderId}`
    );

    console.log(`✓ 仓库: 确认送达 ${shippingOrderId}`);
    return order;
  }

  /**
   * 记录仓库日志
   */
  private async logEvent(
    eventType: string,
    materialId?: string,
    quantity?: number,
    message?: string
  ): Promise<void> {
    const log: WarehouseLog = {
      logId: `LOG-${Date.now()}`,
      eventType,
      materialId,
      quantity,
      message: message || eventType,
      timestamp: new Date(),
    };

    this.warehouseLogs.push(log);
  }

  /**
   * 获取仓库日志
   */
  async getWarehouseLogs(): Promise<WarehouseLog[]> {
    return this.warehouseLogs;
  }
}

export const warehouseSystem = new WarehouseSystem();
