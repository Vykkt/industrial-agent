/**
 * 工业软件模拟API工具集
 * 模拟ERP、MES、PLM、SCADA、OA、IAM、HR等系统的API接口
 */

// 模拟数据生成器
function randomId() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function randomDate(daysAgo: number = 30) {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  return date.toISOString().split('T')[0];
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ==================== ERP系统工具 ====================

/**
 * 查询库存信息
 */
async function erp_query_inventory(params: { materialCode?: string; warehouse?: string }) {
  const materials = [
    { code: 'MAT001', name: '钢板A3', spec: '1000x2000x3mm', unit: '张' },
    { code: 'MAT002', name: '铝合金型材', spec: '40x40x2000mm', unit: '根' },
    { code: 'MAT003', name: '电机M1', spec: '380V/2.2KW', unit: '台' },
    { code: 'MAT004', name: 'PLC模块', spec: 'S7-1200', unit: '个' },
    { code: 'MAT005', name: '传感器', spec: '光电开关', unit: '个' }
  ];

  const warehouses = ['原材料仓', '半成品仓', '成品仓', '备件仓'];
  
  const result = materials
    .filter(m => !params.materialCode || m.code.includes(params.materialCode.toUpperCase()))
    .map(m => ({
      ...m,
      warehouse: params.warehouse || randomChoice(warehouses),
      quantity: Math.floor(Math.random() * 1000) + 10,
      safetyStock: Math.floor(Math.random() * 100) + 50,
      lastInDate: randomDate(15),
      lastOutDate: randomDate(7)
    }));

  return {
    success: true,
    data: result,
    total: result.length,
    queryTime: new Date().toISOString()
  };
}

/**
 * 查询采购订单
 */
async function erp_query_purchase_order(params: { orderNo?: string; status?: string; supplier?: string }) {
  const suppliers = ['上海钢材有限公司', '深圳电子科技', '苏州精密机械', '广州自动化设备'];
  const statuses = ['待审批', '已审批', '采购中', '已到货', '已入库'];
  
  const orders = Array.from({ length: 5 }, (_, i) => ({
    orderNo: params.orderNo || `PO${Date.now().toString().slice(-8)}${i}`,
    supplier: params.supplier || randomChoice(suppliers),
    status: params.status || randomChoice(statuses),
    totalAmount: Math.floor(Math.random() * 100000) + 10000,
    createDate: randomDate(30),
    expectedDate: randomDate(-7),
    items: [
      { materialCode: 'MAT001', quantity: Math.floor(Math.random() * 100), price: 150 },
      { materialCode: 'MAT002', quantity: Math.floor(Math.random() * 50), price: 80 }
    ]
  }));

  return {
    success: true,
    data: params.orderNo ? orders.slice(0, 1) : orders,
    total: params.orderNo ? 1 : orders.length
  };
}

/**
 * 查询财务凭证
 */
async function erp_query_voucher(params: { voucherNo?: string; startDate?: string; endDate?: string }) {
  const voucherTypes = ['收款凭证', '付款凭证', '转账凭证', '记账凭证'];
  
  const vouchers = Array.from({ length: 3 }, (_, i) => ({
    voucherNo: params.voucherNo || `V${Date.now().toString().slice(-6)}${i}`,
    type: randomChoice(voucherTypes),
    date: randomDate(30),
    amount: Math.floor(Math.random() * 50000) + 1000,
    status: randomChoice(['已审核', '待审核', '已过账']),
    summary: '采购物料付款',
    creator: '张三'
  }));

  return {
    success: true,
    data: vouchers,
    total: vouchers.length
  };
}

// ==================== MES系统工具 ====================

/**
 * 查询生产工单
 */
async function mes_query_work_order(params: { orderNo?: string; status?: string; productCode?: string }) {
  const products = ['PROD-A100', 'PROD-B200', 'PROD-C300'];
  const statuses = ['待排程', '已排程', '生产中', '已完工', '已入库'];
  const workstations = ['CNC-01', 'CNC-02', 'ASSEMBLY-01', 'PACK-01'];

  const orders = Array.from({ length: 4 }, (_, i) => ({
    orderNo: params.orderNo || `WO${Date.now().toString().slice(-8)}${i}`,
    productCode: params.productCode || randomChoice(products),
    productName: '精密零件' + (i + 1),
    plannedQty: Math.floor(Math.random() * 500) + 100,
    completedQty: Math.floor(Math.random() * 400),
    status: params.status || randomChoice(statuses),
    workstation: randomChoice(workstations),
    startTime: randomDate(7) + ' 08:00:00',
    plannedEndTime: randomDate(-3) + ' 17:00:00',
    progress: Math.floor(Math.random() * 100)
  }));

  return {
    success: true,
    data: params.orderNo ? orders.slice(0, 1) : orders,
    total: params.orderNo ? 1 : orders.length
  };
}

/**
 * 查询设备状态
 */
async function mes_query_equipment_status(params: { equipmentCode?: string; workshop?: string }) {
  const workshops = ['机加工车间', '装配车间', '包装车间', '检测车间'];
  const equipments = [
    { code: 'CNC-001', name: '数控车床1号', type: 'CNC' },
    { code: 'CNC-002', name: '数控车床2号', type: 'CNC' },
    { code: 'ROBOT-001', name: '焊接机器人', type: 'ROBOT' },
    { code: 'CONV-001', name: '输送线1号', type: 'CONVEYOR' }
  ];

  const result = equipments
    .filter(e => !params.equipmentCode || e.code.includes(params.equipmentCode.toUpperCase()))
    .map(e => ({
      ...e,
      workshop: params.workshop || randomChoice(workshops),
      status: randomChoice(['运行中', '待机', '故障', '维护中']),
      oee: (Math.random() * 30 + 70).toFixed(1) + '%',
      runningHours: Math.floor(Math.random() * 1000) + 500,
      lastMaintenance: randomDate(30),
      nextMaintenance: randomDate(-15)
    }));

  return {
    success: true,
    data: result,
    total: result.length
  };
}

/**
 * 查询质量检验记录
 */
async function mes_query_quality_record(params: { workOrderNo?: string; result?: string; startDate?: string }) {
  const defectTypes = ['尺寸超差', '表面划伤', '装配不良', '功能异常', '外观缺陷'];
  
  const records = Array.from({ length: 5 }, (_, i) => ({
    inspectionNo: `QC${Date.now().toString().slice(-8)}${i}`,
    workOrderNo: params.workOrderNo || `WO${randomId()}`,
    productCode: 'PROD-A100',
    inspectedQty: Math.floor(Math.random() * 100) + 50,
    passedQty: Math.floor(Math.random() * 90) + 40,
    result: params.result || randomChoice(['合格', '不合格', '待复检']),
    defectType: randomChoice(defectTypes),
    inspector: randomChoice(['李四', '王五', '赵六']),
    inspectionTime: randomDate(7) + ' ' + `${Math.floor(Math.random() * 12) + 8}:00:00`
  }));

  return {
    success: true,
    data: records,
    total: records.length,
    passRate: '92.5%'
  };
}

// ==================== PLM系统工具 ====================

/**
 * 查询BOM物料清单
 */
async function plm_query_bom(params: { productCode?: string; version?: string }) {
  const bom = {
    productCode: params.productCode || 'PROD-A100',
    productName: '精密传动装置',
    version: params.version || 'V2.1',
    status: '已发布',
    effectiveDate: randomDate(60),
    components: [
      { level: 1, code: 'COMP-001', name: '主轴组件', qty: 1, unit: '套' },
      { level: 2, code: 'PART-001', name: '主轴', qty: 1, unit: '根' },
      { level: 2, code: 'PART-002', name: '轴承', qty: 4, unit: '个' },
      { level: 1, code: 'COMP-002', name: '传动组件', qty: 1, unit: '套' },
      { level: 2, code: 'PART-003', name: '齿轮', qty: 3, unit: '个' },
      { level: 2, code: 'PART-004', name: '同步带', qty: 2, unit: '条' }
    ],
    totalParts: 6,
    lastModified: randomDate(15),
    modifier: '工程师A'
  };

  return {
    success: true,
    data: bom
  };
}

/**
 * 查询设计变更
 */
async function plm_query_ecn(params: { ecnNo?: string; status?: string; productCode?: string }) {
  const ecns = Array.from({ length: 3 }, (_, i) => ({
    ecnNo: params.ecnNo || `ECN${Date.now().toString().slice(-6)}${i}`,
    productCode: params.productCode || 'PROD-A100',
    title: `设计变更-${randomChoice(['尺寸优化', '材料替换', '工艺改进'])}`,
    status: params.status || randomChoice(['草稿', '审批中', '已批准', '已实施']),
    reason: '客户需求变更/成本优化',
    impact: randomChoice(['低', '中', '高']),
    creator: '工程师B',
    createDate: randomDate(30),
    approver: '主管C',
    approveDate: randomDate(15)
  }));

  return {
    success: true,
    data: ecns,
    total: ecns.length
  };
}

// ==================== SCADA系统工具 ====================

/**
 * 查询设备报警
 */
async function scada_query_alarms(params: { equipmentCode?: string; level?: string; status?: string }) {
  const alarmTypes = [
    { code: 'ALM001', desc: '温度过高', level: 'high' },
    { code: 'ALM002', desc: '压力异常', level: 'high' },
    { code: 'ALM003', desc: '振动超标', level: 'medium' },
    { code: 'ALM004', desc: '通讯中断', level: 'low' },
    { code: 'ALM005', desc: '液位低', level: 'medium' }
  ];

  const alarms = alarmTypes
    .filter(a => !params.level || a.level === params.level)
    .map((a, i) => ({
      alarmId: `A${Date.now().toString().slice(-8)}${i}`,
      equipmentCode: params.equipmentCode || `EQ-${randomId().slice(0, 3)}`,
      equipmentName: randomChoice(['CNC车床', '注塑机', '压缩机', '输送带']),
      alarmCode: a.code,
      alarmDesc: a.desc,
      level: a.level,
      status: params.status || randomChoice(['活动', '已确认', '已处理']),
      triggerTime: randomDate(3) + ' ' + `${Math.floor(Math.random() * 24)}:${Math.floor(Math.random() * 60)}:00`,
      value: (Math.random() * 100).toFixed(2),
      threshold: '80.00',
      operator: randomChoice(['操作员A', '操作员B', null])
    }));

  return {
    success: true,
    data: alarms,
    total: alarms.length,
    activeCount: alarms.filter(a => a.status === '活动').length
  };
}

/**
 * 查询实时数据
 */
async function scada_query_realtime_data(params: { equipmentCode?: string; tagName?: string }) {
  const tags = [
    { name: 'Temperature', unit: '°C', min: 20, max: 100 },
    { name: 'Pressure', unit: 'MPa', min: 0, max: 10 },
    { name: 'Speed', unit: 'RPM', min: 0, max: 3000 },
    { name: 'Current', unit: 'A', min: 0, max: 50 },
    { name: 'Vibration', unit: 'mm/s', min: 0, max: 10 }
  ];

  const data = tags
    .filter(t => !params.tagName || t.name.toLowerCase().includes(params.tagName.toLowerCase()))
    .map(t => ({
      equipmentCode: params.equipmentCode || `EQ-${randomId().slice(0, 3)}`,
      tagName: t.name,
      value: (Math.random() * (t.max - t.min) + t.min).toFixed(2),
      unit: t.unit,
      quality: 'Good',
      timestamp: new Date().toISOString()
    }));

  return {
    success: true,
    data,
    total: data.length
  };
}

// ==================== OA系统工具 ====================

/**
 * 查询审批流程
 */
async function oa_query_workflow(params: { processId?: string; status?: string; applicant?: string }) {
  const processTypes = ['请假申请', '采购申请', '费用报销', '出差申请', '加班申请'];
  
  const workflows = Array.from({ length: 4 }, (_, i) => ({
    processId: params.processId || `WF${Date.now().toString().slice(-8)}${i}`,
    processType: randomChoice(processTypes),
    title: `${randomChoice(processTypes)}-${randomDate(7)}`,
    applicant: params.applicant || randomChoice(['张三', '李四', '王五']),
    status: params.status || randomChoice(['待审批', '审批中', '已通过', '已驳回']),
    currentApprover: randomChoice(['部门经理', '财务主管', '总经理']),
    createTime: randomDate(15) + ' 09:00:00',
    lastUpdateTime: randomDate(3) + ' 14:30:00'
  }));

  return {
    success: true,
    data: workflows,
    total: workflows.length
  };
}

// ==================== IAM系统工具 ====================

/**
 * 查询用户权限
 */
async function iam_query_user_permission(params: { userId?: string; systemCode?: string }) {
  const systems = [
    { code: 'ERP', name: 'ERP系统' },
    { code: 'MES', name: 'MES系统' },
    { code: 'PLM', name: 'PLM系统' },
    { code: 'SCADA', name: 'SCADA系统' }
  ];

  const permissions = systems
    .filter(s => !params.systemCode || s.code === params.systemCode.toUpperCase())
    .map(s => ({
      userId: params.userId || 'USER001',
      userName: '测试用户',
      systemCode: s.code,
      systemName: s.name,
      roles: [randomChoice(['管理员', '操作员', '查看者'])],
      permissions: [
        { code: 'VIEW', name: '查看', granted: true },
        { code: 'EDIT', name: '编辑', granted: Math.random() > 0.3 },
        { code: 'DELETE', name: '删除', granted: Math.random() > 0.7 },
        { code: 'EXPORT', name: '导出', granted: Math.random() > 0.5 }
      ],
      lastLogin: randomDate(7) + ' 08:30:00',
      status: '正常'
    }));

  return {
    success: true,
    data: permissions,
    total: permissions.length
  };
}

// ==================== HR系统工具 ====================

/**
 * 查询考勤记录
 */
async function hr_query_attendance(params: { employeeId?: string; startDate?: string; endDate?: string }) {
  const records = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    return {
      employeeId: params.employeeId || 'EMP001',
      employeeName: '张三',
      department: '信息科',
      date: dateStr,
      checkIn: `${8 + Math.floor(Math.random() * 2)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
      checkOut: `${17 + Math.floor(Math.random() * 3)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
      status: randomChoice(['正常', '迟到', '早退', '缺勤', '请假']),
      workHours: (8 + Math.random() * 2).toFixed(1)
    };
  });

  return {
    success: true,
    data: records,
    total: records.length,
    summary: {
      normalDays: records.filter(r => r.status === '正常').length,
      lateDays: records.filter(r => r.status === '迟到').length,
      absentDays: records.filter(r => r.status === '缺勤').length
    }
  };
}

// ==================== 知识库工具 ====================

/**
 * 搜索知识库
 */
async function knowledge_search(params: { query?: string; category?: string }) {
  const knowledgeBase = [
    {
      id: 1,
      title: 'CNC机床常见故障排除指南',
      category: 'troubleshooting',
      content: '1. 主轴不转：检查主轴驱动器、编码器连接...\n2. 刀具补偿异常：检查刀具参数设置...',
      relevance: 0.95
    },
    {
      id: 2,
      title: 'ERP库存盘点操作规范',
      category: 'operation_guide',
      content: '盘点前准备：1. 停止出入库操作 2. 打印盘点单 3. 组织盘点人员...',
      relevance: 0.88
    },
    {
      id: 3,
      title: 'MES系统工单创建流程',
      category: 'process_spec',
      content: '工单创建步骤：1. 选择产品型号 2. 输入计划数量 3. 选择生产线...',
      relevance: 0.82
    },
    {
      id: 4,
      title: 'SCADA报警处理最佳实践',
      category: 'best_practice',
      content: '报警分级处理：高级报警立即响应，中级报警30分钟内处理...',
      relevance: 0.79
    }
  ];

  const results = knowledgeBase
    .filter(k => !params.category || k.category === params.category)
    .filter(k => 
      !params.query ||
      k.title.toLowerCase().includes(params.query.toLowerCase()) ||
      k.content.toLowerCase().includes((params.query || '').toLowerCase())
    )
    .sort((a, b) => b.relevance - a.relevance);

  return {
    success: true,
    data: results,
    total: results.length,
    query: params.query || ''
  };
}

// ==================== 工具执行入口 ====================

const toolHandlers: Record<string, (params: Record<string, unknown>) => Promise<unknown>> = {
  // ERP工具
  erp_query_inventory,
  erp_query_purchase_order,
  erp_query_voucher,
  // MES工具
  mes_query_work_order,
  mes_query_equipment_status,
  mes_query_quality_record,
  // PLM工具
  plm_query_bom,
  plm_query_ecn,
  // SCADA工具
  scada_query_alarms,
  scada_query_realtime_data,
  // OA工具
  oa_query_workflow,
  // IAM工具
  iam_query_user_permission,
  // HR工具
  hr_query_attendance,
  // 知识库工具
  knowledge_search
};

/**
 * 执行工业软件工具
 */
export async function executeIndustrialTool(
  toolName: string,
  params: Record<string, unknown>
): Promise<unknown> {
  const handler = toolHandlers[toolName];
  
  if (!handler) {
    throw new Error(`未知工具: ${toolName}`);
  }

  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));

  return handler(params);
}

/**
 * 获取所有可用工具的定义
 */
export function getToolDefinitions() {
  return [
    // ERP工具
    {
      name: 'erp_query_inventory',
      displayName: '查询库存',
      description: '查询ERP系统中的物料库存信息，包括库存数量、安全库存、出入库记录等',
      category: 'erp' as const,
      parameters: [
        { name: 'materialCode', type: 'string', description: '物料编码（可选，支持模糊匹配）', required: false },
        { name: 'warehouse', type: 'string', description: '仓库名称（可选）', required: false }
      ]
    },
    {
      name: 'erp_query_purchase_order',
      displayName: '查询采购订单',
      description: '查询ERP系统中的采购订单信息，包括订单状态、供应商、金额等',
      category: 'erp' as const,
      parameters: [
        { name: 'orderNo', type: 'string', description: '采购订单号（可选）', required: false },
        { name: 'status', type: 'string', description: '订单状态（可选）', required: false },
        { name: 'supplier', type: 'string', description: '供应商名称（可选）', required: false }
      ]
    },
    {
      name: 'erp_query_voucher',
      displayName: '查询财务凭证',
      description: '查询ERP系统中的财务凭证信息',
      category: 'erp' as const,
      parameters: [
        { name: 'voucherNo', type: 'string', description: '凭证号（可选）', required: false },
        { name: 'startDate', type: 'string', description: '开始日期（可选，格式YYYY-MM-DD）', required: false },
        { name: 'endDate', type: 'string', description: '结束日期（可选，格式YYYY-MM-DD）', required: false }
      ]
    },
    // MES工具
    {
      name: 'mes_query_work_order',
      displayName: '查询生产工单',
      description: '查询MES系统中的生产工单信息，包括工单状态、进度、工位等',
      category: 'mes' as const,
      parameters: [
        { name: 'orderNo', type: 'string', description: '工单号（可选）', required: false },
        { name: 'status', type: 'string', description: '工单状态（可选）', required: false },
        { name: 'productCode', type: 'string', description: '产品编码（可选）', required: false }
      ]
    },
    {
      name: 'mes_query_equipment_status',
      displayName: '查询设备状态',
      description: '查询MES系统中的设备运行状态，包括OEE、运行时长、维护计划等',
      category: 'mes' as const,
      parameters: [
        { name: 'equipmentCode', type: 'string', description: '设备编码（可选）', required: false },
        { name: 'workshop', type: 'string', description: '车间名称（可选）', required: false }
      ]
    },
    {
      name: 'mes_query_quality_record',
      displayName: '查询质量记录',
      description: '查询MES系统中的质量检验记录，包括检验结果、不良类型等',
      category: 'mes' as const,
      parameters: [
        { name: 'workOrderNo', type: 'string', description: '工单号（可选）', required: false },
        { name: 'result', type: 'string', description: '检验结果（可选：合格/不合格/待复检）', required: false },
        { name: 'startDate', type: 'string', description: '开始日期（可选）', required: false }
      ]
    },
    // PLM工具
    {
      name: 'plm_query_bom',
      displayName: '查询BOM',
      description: '查询PLM系统中的产品BOM物料清单',
      category: 'plm' as const,
      parameters: [
        { name: 'productCode', type: 'string', description: '产品编码', required: true },
        { name: 'version', type: 'string', description: 'BOM版本（可选）', required: false }
      ]
    },
    {
      name: 'plm_query_ecn',
      displayName: '查询设计变更',
      description: '查询PLM系统中的工程变更通知(ECN)',
      category: 'plm' as const,
      parameters: [
        { name: 'ecnNo', type: 'string', description: 'ECN编号（可选）', required: false },
        { name: 'status', type: 'string', description: '状态（可选）', required: false },
        { name: 'productCode', type: 'string', description: '产品编码（可选）', required: false }
      ]
    },
    // SCADA工具
    {
      name: 'scada_query_alarms',
      displayName: '查询设备报警',
      description: '查询SCADA系统中的设备报警信息',
      category: 'scada' as const,
      parameters: [
        { name: 'equipmentCode', type: 'string', description: '设备编码（可选）', required: false },
        { name: 'level', type: 'string', description: '报警级别（可选：high/medium/low）', required: false, enum: ['high', 'medium', 'low'] },
        { name: 'status', type: 'string', description: '报警状态（可选：活动/已确认/已处理）', required: false }
      ]
    },
    {
      name: 'scada_query_realtime_data',
      displayName: '查询实时数据',
      description: '查询SCADA系统中的设备实时运行数据',
      category: 'scada' as const,
      parameters: [
        { name: 'equipmentCode', type: 'string', description: '设备编码（可选）', required: false },
        { name: 'tagName', type: 'string', description: '数据点名称（可选，如Temperature/Pressure/Speed）', required: false }
      ]
    },
    // OA工具
    {
      name: 'oa_query_workflow',
      displayName: '查询审批流程',
      description: '查询OA系统中的审批流程状态',
      category: 'oa' as const,
      parameters: [
        { name: 'processId', type: 'string', description: '流程ID（可选）', required: false },
        { name: 'status', type: 'string', description: '流程状态（可选）', required: false },
        { name: 'applicant', type: 'string', description: '申请人（可选）', required: false }
      ]
    },
    // IAM工具
    {
      name: 'iam_query_user_permission',
      displayName: '查询用户权限',
      description: '查询IAM系统中的用户权限信息',
      category: 'iam' as const,
      parameters: [
        { name: 'userId', type: 'string', description: '用户ID（可选）', required: false },
        { name: 'systemCode', type: 'string', description: '系统编码（可选：ERP/MES/PLM/SCADA）', required: false }
      ]
    },
    // HR工具
    {
      name: 'hr_query_attendance',
      displayName: '查询考勤记录',
      description: '查询HR系统中的员工考勤记录',
      category: 'hr' as const,
      parameters: [
        { name: 'employeeId', type: 'string', description: '员工ID（可选）', required: false },
        { name: 'startDate', type: 'string', description: '开始日期（可选）', required: false },
        { name: 'endDate', type: 'string', description: '结束日期（可选）', required: false }
      ]
    },
    // 知识库工具
    {
      name: 'knowledge_search',
      displayName: '搜索知识库',
      description: '搜索工业知识库，查找设备手册、故障案例、操作规范等',
      category: 'knowledge' as const,
      parameters: [
        { name: 'query', type: 'string', description: '搜索关键词', required: true },
        { name: 'category', type: 'string', description: '知识分类（可选）', required: false }
      ]
    }
  ];
}
