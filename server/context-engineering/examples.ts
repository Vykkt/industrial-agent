/**
 * 上下文工程使用示例
 * 
 * 展示如何在工业智能体中应用Manus的上下文工程最佳实践
 */

import {
  ContextManager,
  KVCacheOptimizer,
  StateMachineToolManager,
  ContextCompressor,
  AttentionManipulator,
  ErrorRetentionManager,
  FewShotTrapAvoider,
  ToolDefinition,
  PrefillConfig
} from './ContextManager';

// ============ 示例1: KV缓存优化 ============

/**
 * 示例：正确和错误的系统提示设计
 */
function kvCacheExample() {
  const optimizer = new KVCacheOptimizer();

  // ❌ 错误做法：在系统提示开头包含时间戳
  const badSystemPrompt = `
Current time: ${new Date().toISOString()}
You are an industrial AI agent...
`;

  // ✅ 正确做法：保持系统提示稳定，动态内容放在末尾或用户消息中
  const goodSystemPrompt = `
You are an industrial AI agent specialized in manufacturing operations.
Your capabilities include:
- ERP system integration
- PLM design management
- MES production control
- Warehouse management

Always follow safety protocols and verify operations before execution.
`;

  // 使用优化器处理动态内容
  const optimizedPrompt = optimizer.optimizeSystemPrompt(goodSystemPrompt, {
    current_time: new Date().toISOString(),
    current_user: 'operator_001',
    current_shift: 'day_shift'
  });

  console.log('优化后的系统提示：');
  console.log(optimizedPrompt);
  
  // 输出：
  // You are an industrial AI agent...
  // <dynamic_context>
  // <current_time>2025-01-01T00:00:00.000Z</current_time>
  // <current_user>operator_001</current_user>
  // <current_shift>day_shift</current_shift>
  // </dynamic_context>

  return optimizer;
}

// ============ 示例2: 状态机工具管理 ============

/**
 * 示例：使用Prefill控制工具选择
 */
function stateMachineExample() {
  const toolManager = new StateMachineToolManager();

  // 注册工业智能体工具（注意命名前缀的一致性）
  const industrialTools: ToolDefinition[] = [
    // ERP相关工具
    { name: 'erp_create_order', description: '创建销售订单', parameters: {}, category: 'erp' },
    { name: 'erp_query_inventory', description: '查询库存', parameters: {}, category: 'erp' },
    { name: 'erp_update_order', description: '更新订单状态', parameters: {}, category: 'erp' },
    
    // PLM相关工具
    { name: 'plm_get_bom', description: '获取BOM', parameters: {}, category: 'plm' },
    { name: 'plm_update_bom', description: '更新BOM', parameters: {}, category: 'plm' },
    { name: 'plm_create_design', description: '创建设计', parameters: {}, category: 'plm' },
    
    // MES相关工具
    { name: 'mes_start_production', description: '开始生产', parameters: {}, category: 'mes' },
    { name: 'mes_report_quality', description: '报告质量', parameters: {}, category: 'mes' },
    { name: 'mes_complete_task', description: '完成任务', parameters: {}, category: 'mes' },
    
    // 仓库相关工具
    { name: 'warehouse_pick', description: '拣货', parameters: {}, category: 'warehouse' },
    { name: 'warehouse_ship', description: '发货', parameters: {}, category: 'warehouse' },
    { name: 'warehouse_receive', description: '收货', parameters: {}, category: 'warehouse' },
  ];

  industrialTools.forEach(tool => toolManager.registerTool(tool));

  // 场景1：用户刚输入，模型可以自由选择
  console.log('\n场景1: 用户输入阶段');
  const autoConfig: PrefillConfig = { mode: 'auto' };
  console.log('Prefill:', toolManager.generatePrefill(autoConfig));
  // 输出: <|im_start|>assistant

  // 场景2：需要执行ERP操作
  console.log('\n场景2: ERP操作阶段');
  const erpConfig: PrefillConfig = { mode: 'specified', toolPrefix: 'erp_' };
  console.log('Prefill:', toolManager.generatePrefill(erpConfig));
  // 输出: <|im_start|>assistant<tool_call>{"name": "erp_

  // 场景3：必须调用特定工具
  console.log('\n场景3: 必须创建订单');
  const specificConfig: PrefillConfig = { mode: 'specified', specificTool: 'erp_create_order' };
  console.log('Prefill:', toolManager.generatePrefill(specificConfig));
  // 输出: <|im_start|>assistant<tool_call>{"name": "erp_create_order"

  // 场景4：必须调用工具，但不限制类型
  console.log('\n场景4: 必须调用工具');
  const requiredConfig: PrefillConfig = { mode: 'required' };
  console.log('Prefill:', toolManager.generatePrefill(requiredConfig));
  // 输出: <|im_start|>assistant<tool_call>

  return toolManager;
}

// ============ 示例3: Logit Bias控制 ============

/**
 * 示例：使用Logit Bias精确控制工具选择
 */
function logitBiasExample() {
  const toolManager = new StateMachineToolManager();

  // 注册工具
  toolManager.registerTool({ name: 'erp_create_order', description: '', parameters: {}, category: 'erp' });
  toolManager.registerTool({ name: 'plm_get_bom', description: '', parameters: {}, category: 'plm' });
  toolManager.registerTool({ name: 'mes_start_production', description: '', parameters: {}, category: 'mes' });

  // 模拟token编码器（实际使用时需要tiktoken等库）
  const mockTokenEncoder = (text: string): number[] => {
    // 简化的模拟实现
    const tokenMap: Record<string, number> = {
      'erp_create_order': 12345,
      'plm_get_bom': 12346,
      'mes_start_production': 12347,
    };
    return [tokenMap[text] || 0];
  };

  // 只允许ERP工具
  const logitBias = toolManager.generateLogitBias(['erp'], mockTokenEncoder);
  
  console.log('\n只允许ERP工具的Logit Bias:');
  console.log(logitBias);
  // 输出: { '12345': 15, '12346': -100, '12347': -100 }
  // 说明：erp_create_order被提升(+15)，其他工具被阻止(-100)

  return logitBias;
}

// ============ 示例4: 上下文压缩 ============

/**
 * 示例：压缩大型观察结果
 */
function compressionExample() {
  const compressor = new ContextCompressor();

  // 模拟大型网页内容
  const webpageContent = `
    <html>
      <head><title>ERP System Dashboard</title></head>
      <body>
        <h1>Order Management</h1>
        <table>
          <tr><td>Order ID</td><td>Status</td><td>Amount</td></tr>
          ${Array(100).fill(0).map((_, i) => 
            `<tr><td>ORD-${i}</td><td>Active</td><td>$${i * 100}</td></tr>`
          ).join('\n')}
        </table>
        <!-- 更多内容... -->
      </body>
    </html>
  `;

  console.log('\n原始网页大小:', webpageContent.length, 'chars');

  // 压缩网页内容
  const { compressed, canRestore } = compressor.compressObservation(webpageContent, {
    type: 'webpage',
    url: 'https://erp.example.com/orders'
  });

  console.log('压缩后:', compressed);
  console.log('可恢复:', canRestore);
  console.log('压缩统计:', compressor.getStats());
  // 输出:
  // 压缩后: [Webpage content from https://erp.example.com/orders - 5234 chars, can be re-fetched]
  // 可恢复: true
  // 压缩统计: { originalSize: 5234, compressedSize: 78, ratio: 67.1 }

  return compressor;
}

// ============ 示例5: 注意力操控 ============

/**
 * 示例：使用todo.md引导模型注意力
 */
function attentionExample() {
  const attention = new AttentionManipulator();

  // 设置任务目标
  attention.setObjective('完成涡旋压缩机订单的端到端处理');

  // 添加待办事项
  attention.addTodoItem('在ERP中创建销售订单');
  attention.addTodoItem('在PLM中修改BOM（更换机油型号）');
  attention.addTodoItem('创建采购订单');
  attention.addTodoItem('在MES中执行生产任务');
  attention.addTodoItem('完成质量检测');
  attention.addTodoItem('仓库发货');

  // 模拟任务进度
  attention.markComplete('在ERP中创建销售订单');
  attention.markComplete('在PLM中修改BOM（更换机油型号）');

  // 生成todo.md
  console.log('\n生成的todo.md:');
  console.log(attention.generateTodoMarkdown());
  // 输出:
  // # Current Task
  // **Objective:** 完成涡旋压缩机订单的端到端处理
  // ## Progress
  // ### Completed
  // - [x] 在ERP中创建销售订单
  // - [x] 在PLM中修改BOM（更换机油型号）
  // ### Remaining
  // - [ ] 创建采购订单
  // - [ ] 在MES中执行生产任务
  // - [ ] 完成质量检测
  // - [ ] 仓库发货

  // 生成注意力引导
  console.log('\n注意力引导:', attention.generateAttentionGuide());
  // 输出: [Progress: 2/6 tasks completed. Current focus: 创建采购订单]

  return attention;
}

// ============ 示例6: 错误保留 ============

/**
 * 示例：保留错误帮助模型学习
 */
function errorRetentionExample() {
  const errorManager = new ErrorRetentionManager();

  // 记录错误
  errorManager.recordError('erp_create_order', 'Connection timeout to ERP server');
  errorManager.recordError('plm_update_bom', 'BOM version conflict detected');
  
  // 标记第一个错误已恢复
  errorManager.markRecovered('erp_create_order');

  // 生成错误上下文
  console.log('\n错误上下文:');
  console.log(errorManager.generateErrorContext());
  // 输出:
  // <previous_errors>
  // Action: erp_create_order
  // Error: Connection timeout to ERP server
  // Status: Recovered
  // ---
  // Action: plm_update_bom
  // Error: BOM version conflict detected
  // Status: Unresolved
  // ---
  // </previous_errors>

  console.log('错误统计:', errorManager.getStats());
  // 输出: { total: 2, recovered: 1, recoveryRate: 0.5 }

  return errorManager;
}

// ============ 示例7: 避免Few-Shot陷阱 ============

/**
 * 示例：引入变异避免模式固化
 */
function fewShotAvoidanceExample() {
  const avoider = new FewShotTrapAvoider();

  const action = 'erp_create_order';
  const result = 'Order SO-001 created successfully';

  // 多次序列化，观察变异
  console.log('\n序列化变异示例:');
  for (let i = 0; i < 5; i++) {
    console.log(`${i + 1}. ${avoider.serializeWithVariation(action, result)}`);
  }
  // 可能的输出:
  // 1. Action: erp_create_order\nResult: Order SO-001 created successfully
  // 2. [erp_create_order] → Order SO-001 created successfully
  // 3. 执行 erp_create_order，返回 Order SO-001 created successfully
  // 4. Executed erp_create_order. Output: Order SO-001 created successfully
  // 5. erp_create_order completed with: Order SO-001 created successfully

  // 措辞变体
  console.log('\n措辞变体:');
  for (let i = 0; i < 3; i++) {
    console.log(`success: ${avoider.getPhrasingVariant('success')}`);
  }

  return avoider;
}

// ============ 示例8: 完整集成示例 ============

/**
 * 示例：完整的上下文管理流程
 */
async function fullIntegrationExample() {
  const contextManager = new ContextManager();

  // 1. 初始化系统提示
  contextManager.initializeSystemPrompt(`
You are an industrial AI agent specialized in manufacturing operations.
You have access to ERP, PLM, MES, and Warehouse systems.
Always verify operations before execution and handle errors gracefully.
  `);

  // 2. 注册工具
  const tools: ToolDefinition[] = [
    { name: 'erp_create_order', description: '创建订单', parameters: {}, category: 'erp' },
    { name: 'erp_query_inventory', description: '查询库存', parameters: {}, category: 'erp' },
    { name: 'plm_get_bom', description: '获取BOM', parameters: {}, category: 'plm' },
    { name: 'plm_update_bom', description: '更新BOM', parameters: {}, category: 'plm' },
    { name: 'mes_start_production', description: '开始生产', parameters: {}, category: 'mes' },
    { name: 'warehouse_ship', description: '发货', parameters: {}, category: 'warehouse' },
  ];
  tools.forEach(tool => contextManager.registerTool(tool));

  // 3. 设置任务目标
  contextManager.setObjective('处理涡旋压缩机订单');
  contextManager.addTodoItem('创建销售订单');
  contextManager.addTodoItem('修改BOM');
  contextManager.addTodoItem('执行生产');
  contextManager.addTodoItem('发货');

  // 4. 添加用户消息
  contextManager.addUserMessage('请帮我处理一个涡旋压缩机的订单，需要修改BOM中的机油型号');

  // 5. 获取用于API调用的消息（带prefill）
  const apiPayload = contextManager.getMessagesForAPI('erp');
  console.log('\nAPI调用载荷:');
  console.log('消息数量:', apiPayload.messages.length);
  console.log('Prefill:', apiPayload.prefill);

  // 6. 模拟工具调用
  contextManager.addAssistantToolCall('erp_create_order', {
    product: '涡旋压缩机',
    quantity: 10,
    customer: 'ABC公司'
  });

  // 7. 添加工具结果
  contextManager.addToolResult('erp_create_order', JSON.stringify({
    orderId: 'SO-001',
    status: 'created',
    amount: 100000
  }), { type: 'api_response' });

  // 8. 标记完成
  contextManager.markTodoComplete('创建销售订单');

  // 9. 模拟错误
  contextManager.addError('plm_update_bom', 'Version conflict: BOM was modified by another user');

  // 10. 获取统计
  console.log('\n上下文统计:');
  console.log(contextManager.getStats());

  return contextManager;
}

// ============ 运行所有示例 ============

async function runAllExamples() {
  console.log('='.repeat(60));
  console.log('上下文工程示例');
  console.log('='.repeat(60));

  console.log('\n--- 示例1: KV缓存优化 ---');
  kvCacheExample();

  console.log('\n--- 示例2: 状态机工具管理 ---');
  stateMachineExample();

  console.log('\n--- 示例3: Logit Bias控制 ---');
  logitBiasExample();

  console.log('\n--- 示例4: 上下文压缩 ---');
  compressionExample();

  console.log('\n--- 示例5: 注意力操控 ---');
  attentionExample();

  console.log('\n--- 示例6: 错误保留 ---');
  errorRetentionExample();

  console.log('\n--- 示例7: 避免Few-Shot陷阱 ---');
  fewShotAvoidanceExample();

  console.log('\n--- 示例8: 完整集成 ---');
  await fullIntegrationExample();

  console.log('\n' + '='.repeat(60));
  console.log('所有示例运行完成');
  console.log('='.repeat(60));
}

// 导出示例函数
export {
  kvCacheExample,
  stateMachineExample,
  logitBiasExample,
  compressionExample,
  attentionExample,
  errorRetentionExample,
  fewShotAvoidanceExample,
  fullIntegrationExample,
  runAllExamples
};
