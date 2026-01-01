/**
 * 模拟ERP系统
 * 负责订单管理、采购订单、生产订单等功能
 */

import { v4 as uuidv4 } from 'nanoid';

export interface SalesOrder {
  orderId: string;
  customerName: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  orderDate: Date;
  requiredDate: Date;
  status: 'pending' | 'confirmed' | 'processing' | 'completed' | 'cancelled';
  createdAt: Date;
}

export interface PurchaseOrder {
  poId: string;
  supplierId: string;
  supplierName: string;
  items: Array<{
    materialId: string;
    materialName: string;
    quantity: number;
    unitPrice: number;
  }>;
  totalAmount: number;
  orderDate: Date;
  requiredDate: Date;
  status: 'draft' | 'confirmed' | 'received' | 'completed' | 'cancelled';
  createdAt: Date;
}

export interface ProductionOrder {
  poId: string;
  productId: string;
  productName: string;
  quantity: number;
  bomVersion: string;
  startDate: Date;
  endDate: Date;
  status: 'draft' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: Date;
}

export class ERPSystem {
  private salesOrders: Map<string, SalesOrder> = new Map();
  private purchaseOrders: Map<string, PurchaseOrder> = new Map();
  private productionOrders: Map<string, ProductionOrder> = new Map();
  private products: Map<string, any> = new Map();
  private materials: Map<string, any> = new Map();

  constructor() {
    this.initializeProducts();
    this.initializeMaterials();
  }

  /**
   * 初始化产品信息
   */
  private initializeProducts(): void {
    this.products.set('PROD-VORTEX-001', {
      productId: 'PROD-VORTEX-001',
      productName: '涡旋压缩机',
      description: '高效能涡旋压缩机',
      category: 'Compressor',
      unitPrice: 5000,
      bomId: 'BOM-VORTEX-001',
      bomVersion: 'V1.0',
      createdAt: new Date(),
    });
  }

  /**
   * 初始化物料信息
   */
  private initializeMaterials(): void {
    const materials = [
      {
        materialId: 'MAT-MOTOR-001',
        materialName: '电机',
        category: 'Motor',
        unitPrice: 800,
        supplier: 'Supplier A',
      },
      {
        materialId: 'MAT-ROTOR-001',
        materialName: '转子',
        category: 'Rotor',
        unitPrice: 600,
        supplier: 'Supplier B',
      },
      {
        materialId: 'MAT-STATOR-001',
        materialName: '定子',
        category: 'Stator',
        unitPrice: 500,
        supplier: 'Supplier B',
      },
      {
        materialId: 'MAT-OIL-001',
        materialName: '冷冻油',
        category: 'Oil',
        unitPrice: 100,
        supplier: 'Supplier C',
      },
      {
        materialId: 'MAT-HOUSING-001',
        materialName: '外壳',
        category: 'Housing',
        unitPrice: 300,
        supplier: 'Supplier D',
      },
      {
        materialId: 'MAT-BEARING-001',
        materialName: '轴承',
        category: 'Bearing',
        unitPrice: 200,
        supplier: 'Supplier E',
      },
    ];

    materials.forEach(mat => {
      this.materials.set(mat.materialId, mat);
    });
  }

  /**
   * 创建销售订单
   */
  async createSalesOrder(
    customerName: string,
    productId: string,
    quantity: number
  ): Promise<SalesOrder> {
    const product = this.products.get(productId);
    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    const orderId = `SO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const totalPrice = product.unitPrice * quantity;

    const salesOrder: SalesOrder = {
      orderId,
      customerName,
      productId,
      productName: product.productName,
      quantity,
      unitPrice: product.unitPrice,
      totalPrice,
      orderDate: new Date(),
      requiredDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后
      status: 'pending',
      createdAt: new Date(),
    };

    this.salesOrders.set(orderId, salesOrder);
    console.log(`✓ ERP: 创建销售订单 ${orderId}`);
    return salesOrder;
  }

  /**
   * 确认销售订单
   */
  async confirmSalesOrder(orderId: string): Promise<SalesOrder> {
    const order = this.salesOrders.get(orderId);
    if (!order) {
      throw new Error(`Sales order ${orderId} not found`);
    }

    order.status = 'confirmed';
    console.log(`✓ ERP: 确认销售订单 ${orderId}`);
    return order;
  }

  /**
   * 创建生产订单
   */
  async createProductionOrder(
    productId: string,
    quantity: number,
    bomVersion: string
  ): Promise<ProductionOrder> {
    const product = this.products.get(productId);
    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    const poId = `PO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const productionOrder: ProductionOrder = {
      poId,
      productId,
      productName: product.productName,
      quantity,
      bomVersion,
      startDate: new Date(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14天后
      status: 'draft',
      createdAt: new Date(),
    };

    this.productionOrders.set(poId, productionOrder);
    console.log(`✓ ERP: 创建生产订单 ${poId}`);
    return productionOrder;
  }

  /**
   * 创建采购订单
   */
  async createPurchaseOrder(
    supplierId: string,
    items: Array<{
      materialId: string;
      quantity: number;
    }>
  ): Promise<PurchaseOrder> {
    let totalAmount = 0;
    const poItems = [];

    for (const item of items) {
      const material = this.materials.get(item.materialId);
      if (!material) {
        throw new Error(`Material ${item.materialId} not found`);
      }

      const itemTotal = material.unitPrice * item.quantity;
      totalAmount += itemTotal;

      poItems.push({
        materialId: item.materialId,
        materialName: material.materialName,
        quantity: item.quantity,
        unitPrice: material.unitPrice,
      });
    }

    const poId = `PO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const purchaseOrder: PurchaseOrder = {
      poId,
      supplierId,
      supplierName: `Supplier-${supplierId}`,
      items: poItems,
      totalAmount,
      orderDate: new Date(),
      requiredDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天后
      status: 'draft',
      createdAt: new Date(),
    };

    this.purchaseOrders.set(poId, purchaseOrder);
    console.log(`✓ ERP: 创建采购订单 ${poId}`);
    return purchaseOrder;
  }

  /**
   * 获取销售订单
   */
  async getSalesOrder(orderId: string): Promise<SalesOrder | null> {
    return this.salesOrders.get(orderId) || null;
  }

  /**
   * 获取生产订单
   */
  async getProductionOrder(poId: string): Promise<ProductionOrder | null> {
    return this.productionOrders.get(poId) || null;
  }

  /**
   * 获取采购订单
   */
  async getPurchaseOrder(poId: string): Promise<PurchaseOrder | null> {
    return this.purchaseOrders.get(poId) || null;
  }

  /**
   * 获取所有销售订单
   */
  async getAllSalesOrders(): Promise<SalesOrder[]> {
    return Array.from(this.salesOrders.values());
  }

  /**
   * 更新生产订单状态
   */
  async updateProductionOrderStatus(
    poId: string,
    status: ProductionOrder['status']
  ): Promise<ProductionOrder> {
    const order = this.productionOrders.get(poId);
    if (!order) {
      throw new Error(`Production order ${poId} not found`);
    }

    order.status = status;
    console.log(`✓ ERP: 更新生产订单状态 ${poId} -> ${status}`);
    return order;
  }

  /**
   * 获取产品信息
   */
  async getProduct(productId: string): Promise<any> {
    return this.products.get(productId);
  }

  /**
   * 获取物料信息
   */
  async getMaterial(materialId: string): Promise<any> {
    return this.materials.get(materialId);
  }

  /**
   * 获取所有物料
   */
  async getAllMaterials(): Promise<any[]> {
    return Array.from(this.materials.values());
  }
}

export const erpSystem = new ERPSystem();
