/**
 * 模拟PLM系统
 * 负责BOM管理、设计变更、物料管理等功能
 */

export interface BOMItem {
  itemId: string;
  materialId: string;
  materialName: string;
  quantity: number;
  unitOfMeasure: string;
  sequenceNumber: number;
  notes?: string;
}

export interface BOM {
  bomId: string;
  productId: string;
  productName: string;
  version: string;
  items: BOMItem[];
  createdBy: string;
  createdAt: Date;
  modifiedBy?: string;
  modifiedAt?: Date;
  status: 'draft' | 'released' | 'obsolete';
}

export interface DesignChange {
  changeId: string;
  bomId: string;
  changeType: 'add' | 'remove' | 'modify';
  affectedItems: BOMItem[];
  reason: string;
  approvedBy?: string;
  approvedAt?: Date;
  status: 'pending' | 'approved' | 'rejected' | 'implemented';
  createdAt: Date;
}

export class PLMSystem {
  private boms: Map<string, BOM> = new Map();
  private designChanges: Map<string, DesignChange> = new Map();

  constructor() {
    this.initializeBOMs();
  }

  /**
   * 初始化BOM
   */
  private initializeBOMs(): void {
    const vortexBOM: BOM = {
      bomId: 'BOM-VORTEX-001',
      productId: 'PROD-VORTEX-001',
      productName: '涡旋压缩机',
      version: 'V1.0',
      items: [
        {
          itemId: 'ITEM-001',
          materialId: 'MAT-MOTOR-001',
          materialName: '电机',
          quantity: 1,
          unitOfMeasure: 'PCS',
          sequenceNumber: 1,
        },
        {
          itemId: 'ITEM-002',
          materialId: 'MAT-ROTOR-001',
          materialName: '转子',
          quantity: 1,
          unitOfMeasure: 'PCS',
          sequenceNumber: 2,
        },
        {
          itemId: 'ITEM-003',
          materialId: 'MAT-STATOR-001',
          materialName: '定子',
          quantity: 1,
          unitOfMeasure: 'PCS',
          sequenceNumber: 3,
        },
        {
          itemId: 'ITEM-004',
          materialId: 'MAT-OIL-001',
          materialName: '冷冻油',
          quantity: 2,
          unitOfMeasure: 'L',
          sequenceNumber: 4,
          notes: '标准冷冻油',
        },
        {
          itemId: 'ITEM-005',
          materialId: 'MAT-HOUSING-001',
          materialName: '外壳',
          quantity: 1,
          unitOfMeasure: 'PCS',
          sequenceNumber: 5,
        },
        {
          itemId: 'ITEM-006',
          materialId: 'MAT-BEARING-001',
          materialName: '轴承',
          quantity: 2,
          unitOfMeasure: 'PCS',
          sequenceNumber: 6,
        },
      ],
      createdBy: 'System',
      createdAt: new Date(),
      status: 'released',
    };

    this.boms.set(vortexBOM.bomId, vortexBOM);
  }

  /**
   * 获取BOM
   */
  async getBOM(bomId: string): Promise<BOM | null> {
    return this.boms.get(bomId) || null;
  }

  /**
   * 获取产品的所有BOM版本
   */
  async getBOMsByProduct(productId: string): Promise<BOM[]> {
    return Array.from(this.boms.values()).filter(
      bom => bom.productId === productId
    );
  }

  /**
   * 创建BOM版本
   */
  async createBOMVersion(
    productId: string,
    productName: string,
    items: BOMItem[],
    baseVersion: string
  ): Promise<BOM> {
    const versionNumber = parseInt(baseVersion.replace('V', '')) + 1;
    const newVersion = `V${versionNumber}.0`;
    const bomId = `BOM-${productId}-${newVersion}`;

    const bom: BOM = {
      bomId,
      productId,
      productName,
      version: newVersion,
      items,
      createdBy: 'System',
      createdAt: new Date(),
      status: 'draft',
    };

    this.boms.set(bomId, bom);
    console.log(`✓ PLM: 创建BOM版本 ${bomId} (${newVersion})`);
    return bom;
  }

  /**
   * 修改BOM物料
   * 特别是修改机油物料号
   */
  async modifyBOMItem(
    bomId: string,
    itemId: string,
    newMaterialId: string,
    newMaterialName: string,
    newQuantity?: number
  ): Promise<BOM> {
    const bom = this.boms.get(bomId);
    if (!bom) {
      throw new Error(`BOM ${bomId} not found`);
    }

    const item = bom.items.find(i => i.itemId === itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found in BOM`);
    }

    const oldMaterialId = item.materialId;
    item.materialId = newMaterialId;
    item.materialName = newMaterialName;
    if (newQuantity !== undefined) {
      item.quantity = newQuantity;
    }

    bom.modifiedBy = 'System';
    bom.modifiedAt = new Date();

    console.log(
      `✓ PLM: 修改BOM物料 ${itemId}: ${oldMaterialId} -> ${newMaterialId}`
    );

    // 创建设计变更记录
    await this.createDesignChange(
      bomId,
      'modify',
      [item],
      `修改物料 ${oldMaterialId} 为 ${newMaterialId}`
    );

    return bom;
  }

  /**
   * 添加BOM物料
   */
  async addBOMItem(
    bomId: string,
    materialId: string,
    materialName: string,
    quantity: number,
    sequenceNumber: number
  ): Promise<BOM> {
    const bom = this.boms.get(bomId);
    if (!bom) {
      throw new Error(`BOM ${bomId} not found`);
    }

    const newItem: BOMItem = {
      itemId: `ITEM-${Date.now()}`,
      materialId,
      materialName,
      quantity,
      unitOfMeasure: 'PCS',
      sequenceNumber,
    };

    bom.items.push(newItem);
    bom.modifiedBy = 'System';
    bom.modifiedAt = new Date();

    console.log(
      `✓ PLM: 添加BOM物料 ${materialId} (${materialName}) 到 ${bomId}`
    );

    return bom;
  }

  /**
   * 删除BOM物料
   */
  async removeBOMItem(bomId: string, itemId: string): Promise<BOM> {
    const bom = this.boms.get(bomId);
    if (!bom) {
      throw new Error(`BOM ${bomId} not found`);
    }

    const itemIndex = bom.items.findIndex(i => i.itemId === itemId);
    if (itemIndex === -1) {
      throw new Error(`Item ${itemId} not found in BOM`);
    }

    const removedItem = bom.items.splice(itemIndex, 1)[0];
    bom.modifiedBy = 'System';
    bom.modifiedAt = new Date();

    console.log(`✓ PLM: 删除BOM物料 ${itemId} 从 ${bomId}`);

    return bom;
  }

  /**
   * 发布BOM
   */
  async releaseBOM(bomId: string): Promise<BOM> {
    const bom = this.boms.get(bomId);
    if (!bom) {
      throw new Error(`BOM ${bomId} not found`);
    }

    bom.status = 'released';
    bom.modifiedAt = new Date();

    console.log(`✓ PLM: 发布BOM ${bomId}`);
    return bom;
  }

  /**
   * 创建设计变更
   */
  async createDesignChange(
    bomId: string,
    changeType: 'add' | 'remove' | 'modify',
    affectedItems: BOMItem[],
    reason: string
  ): Promise<DesignChange> {
    const changeId = `ECN-${Date.now()}`;

    const designChange: DesignChange = {
      changeId,
      bomId,
      changeType,
      affectedItems,
      reason,
      status: 'pending',
      createdAt: new Date(),
    };

    this.designChanges.set(changeId, designChange);
    console.log(`✓ PLM: 创建设计变更 ${changeId}`);
    return designChange;
  }

  /**
   * 批准设计变更
   */
  async approveDesignChange(changeId: string): Promise<DesignChange> {
    const change = this.designChanges.get(changeId);
    if (!change) {
      throw new Error(`Design change ${changeId} not found`);
    }

    change.status = 'approved';
    change.approvedBy = 'System';
    change.approvedAt = new Date();

    console.log(`✓ PLM: 批准设计变更 ${changeId}`);
    return change;
  }

  /**
   * 实施设计变更
   */
  async implementDesignChange(changeId: string): Promise<DesignChange> {
    const change = this.designChanges.get(changeId);
    if (!change) {
      throw new Error(`Design change ${changeId} not found`);
    }

    change.status = 'implemented';
    console.log(`✓ PLM: 实施设计变更 ${changeId}`);
    return change;
  }

  /**
   * 获取设计变更
   */
  async getDesignChange(changeId: string): Promise<DesignChange | null> {
    return this.designChanges.get(changeId) || null;
  }

  /**
   * 获取BOM的所有设计变更
   */
  async getDesignChangesByBOM(bomId: string): Promise<DesignChange[]> {
    return Array.from(this.designChanges.values()).filter(
      change => change.bomId === bomId
    );
  }
}

export const plmSystem = new PLMSystem();
