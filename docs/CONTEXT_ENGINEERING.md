# 上下文工程技术文档

## 概述

本文档详细说明了基于Manus最佳实践的上下文工程实现。上下文工程是构建高效AI Agent的核心技术，通过精心设计上下文结构，可以显著提升Agent的性能、降低成本、提高稳定性。

## 核心原则

### 为什么选择上下文工程而非模型微调？

Manus团队在项目初期面临关键决策：是使用开源基础模型进行端到端的Agent模型训练，还是基于前沿模型的上下文学习能力构建Agent？

**选择上下文工程的原因：**

1. **快速迭代** - 可以在数小时内发布改进，而非数周
2. **模型无关性** - 产品与底层模型正交，模型进步是涨潮，Agent是船而非固定在海床上的柱子
3. **灵活性** - 可以快速适应新的模型和API

---

## 1. KV缓存优化

### 原理

KV缓存（Key-Value Cache）是LLM推理中的关键优化技术。对于具有相同前缀的上下文，可以复用之前计算的KV值，大幅减少计算量。

**成本差异示例（Claude Sonnet）：**
- 缓存命中的token：$0.30/MTok
- 未缓存的token：$3.00/MTok
- **差异：10倍**

### Manus的实践

在Manus中，平均输入输出token比例约为100:1，这使得KV缓存优化尤为重要。

### 最佳实践

#### 1.1 保持Prompt前缀稳定

```typescript
// ❌ 错误做法：在系统提示开头包含时间戳
const badSystemPrompt = `
Current time: ${new Date().toISOString()}  // 每秒都会变化！
You are an industrial AI agent...
`;

// ✅ 正确做法：将动态内容放在末尾或用户消息中
const goodSystemPrompt = `
You are an industrial AI agent specialized in manufacturing operations.
Your capabilities include:
- ERP system integration
- PLM design management
- MES production control
`;

// 动态内容放在末尾
const optimizedPrompt = optimizer.optimizeSystemPrompt(goodSystemPrompt, {
  current_time: new Date().toISOString(),
  current_user: 'operator_001'
});
```

#### 1.2 上下文只追加不修改

```typescript
// ❌ 错误做法：修改之前的消息
messages[5].content = 'Updated content';  // 会使后续所有缓存失效

// ✅ 正确做法：只追加新消息
messages.push({
  role: 'assistant',
  content: 'New response'
});
```

#### 1.3 确保序列化确定性

```typescript
// ❌ 错误做法：直接JSON.stringify（键顺序不确定）
const serialized = JSON.stringify(obj);

// ✅ 正确做法：使用确定性序列化
const deterministicSerialize = (obj: any): string => {
  return JSON.stringify(obj, (key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value).sort().reduce((sorted: any, k) => {
        sorted[k] = value[k];
        return sorted;
      }, {});
    }
    return value;
  });
};
```

### 代码实现

参见 `server/context-engineering/ContextManager.ts` 中的 `KVCacheOptimizer` 类。

---

## 2. 状态机工具管理（Logits Masking）

### 原理

当Agent能力增强时，工具数量会爆炸式增长。动态添加/删除工具会导致两个问题：

1. **KV缓存失效** - 工具定义通常在上下文前部，任何变化都会使后续缓存失效
2. **模型困惑** - 当之前的action引用了已删除的工具时，模型会产生混淆

### Manus的解决方案

**核心原则：Mask, Don't Remove**

不是删除工具，而是通过logits masking在解码时控制工具的可用性。

### Response Prefill技术

通过预填充响应的开头部分，约束模型的工具选择：

```typescript
// 三种模式（使用Hermes格式）

// 1. Auto - 模型可以选择调用或不调用函数
prefill: '<|im_start|>assistant'

// 2. Required - 必须调用函数，但不限制具体哪个
prefill: '<|im_start|>assistant<tool_call>'

// 3. Specified - 必须调用特定类别的函数
prefill: '<|im_start|>assistant<tool_call>{"name": "browser_'
```

### 工具命名规范

Manus刻意设计了一致的工具名称前缀：

```typescript
// 浏览器相关工具
browser_navigate
browser_click
browser_input

// 命令行工具
shell_exec
shell_view

// 文件操作工具
file_read
file_write

// 工业系统工具
erp_create_order
erp_query_inventory
plm_get_bom
plm_update_bom
mes_start_production
warehouse_ship
```

这种设计允许通过前缀轻松约束工具选择，无需使用有状态的logits处理器。

### Logit Bias实现

```typescript
// 使用OpenAI API的logit_bias参数
const logitBias: Record<string, number> = {};

// 允许的工具：提升概率
logitBias['erp_token_id'] = 15;

// 禁止的工具：降低概率
logitBias['plm_token_id'] = -100;

// API调用
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: messages,
  tools: ALL_TOOLS,  // 始终包含所有工具
  logit_bias: logitBias  // 通过bias控制
});
```

### 代码实现

参见 `server/context-engineering/ContextManager.ts` 中的 `StateMachineToolManager` 类。

---

## 3. 文件系统作为外部记忆

### 原理

现代LLM虽然支持128K+的上下文窗口，但在实际Agent场景中仍然不够：

1. **观察结果可能很大** - 网页、PDF等非结构化数据
2. **性能下降** - 超过一定长度后模型性能会下降
3. **成本高昂** - 长输入即使有缓存也很昂贵

### Manus的解决方案

将文件系统作为无限的外部记忆：

```typescript
// 压缩策略必须是可恢复的

// 网页内容 -> 保留URL，删除内容
compressed: '[Webpage from https://erp.example.com - can be re-fetched]'

// 文件内容 -> 保留路径，删除内容
compressed: '[File from /data/report.pdf - can be re-read]'
```

### 压缩比

Manus实现了约100:1的压缩比，同时保持信息的完整可恢复性。

### 代码实现

参见 `server/context-engineering/ContextManager.ts` 中的 `ContextCompressor` 类。

---

## 4. 注意力操控

### 原理

在长上下文中，模型容易偏离主题或忘记早期目标（"lost-in-the-middle"问题）。

### Manus的解决方案

通过不断重写todo.md文件，将全局计划推送到上下文末尾：

```markdown
# Current Task

**Objective:** 完成涡旋压缩机订单的端到端处理

## Progress

### Completed
- [x] 在ERP中创建销售订单
- [x] 在PLM中修改BOM

### Remaining
- [ ] 创建采购订单
- [ ] 在MES中执行生产任务
- [ ] 完成质量检测
- [ ] 仓库发货
```

这种机制使用自然语言将模型的注意力引导到任务目标上，无需特殊的架构改变。

### 代码实现

参见 `server/context-engineering/ContextManager.ts` 中的 `AttentionManipulator` 类。

---

## 5. 错误保留

### 原理

常见的冲动是隐藏错误：清理trace、重试action、重置状态。但这会移除证据，模型无法从中学习。

### Manus的解决方案

**核心原则：Keep the Wrong Stuff In**

保留错误的action和observation在上下文中：

```xml
<previous_errors>
Action: erp_create_order
Error: Connection timeout to ERP server
Status: Recovered
---
Action: plm_update_bom
Error: BOM version conflict detected
Status: Unresolved
---
</previous_errors>
```

当模型看到失败的action和结果时，它会隐式更新内部信念，减少重复同样错误的概率。

**错误恢复是真正Agent行为的最清晰指标。**

### 代码实现

参见 `server/context-engineering/ContextManager.ts` 中的 `ErrorRetentionManager` 类。

---

## 6. 避免Few-Shot陷阱

### 原理

语言模型是优秀的模仿者，会模仿上下文中的行为模式。如果上下文充满相似的action-observation对，模型会遵循该模式，即使不再最优。

这在重复性任务中特别危险，导致：
- 漂移
- 过度泛化
- 幻觉

### Manus的解决方案

引入结构化变异：

```typescript
// 不同的序列化模板
const templates = [
  'Action: {action}\nResult: {result}',
  '[{action}] → {result}',
  '执行 {action}，返回 {result}',
  'Executed {action}. Output: {result}'
];

// 随机选择模板
const template = templates[Math.floor(Math.random() * templates.length)];
```

这种受控的随机性帮助打破模式，调整模型的注意力。

### 代码实现

参见 `server/context-engineering/ContextManager.ts` 中的 `FewShotTrapAvoider` 类。

---

## 集成指南

### 基本使用

```typescript
import { ContextManager } from './server/context-engineering/ContextManager';

// 创建上下文管理器
const contextManager = new ContextManager();

// 初始化系统提示（不要在开头包含时间戳！）
contextManager.initializeSystemPrompt(`
You are an industrial AI agent...
`);

// 注册工具
contextManager.registerTool({
  name: 'erp_create_order',
  description: '创建订单',
  parameters: {},
  category: 'erp'
});

// 设置任务目标
contextManager.setObjective('处理涡旋压缩机订单');
contextManager.addTodoItem('创建销售订单');

// 添加用户消息
contextManager.addUserMessage('请帮我处理订单');

// 获取API调用载荷（带prefill）
const payload = contextManager.getMessagesForAPI('erp');
// payload.messages - 消息列表
// payload.prefill - 预填充配置

// 添加工具调用结果
contextManager.addToolResult('erp_create_order', result, { type: 'api_response' });

// 标记完成
contextManager.markTodoComplete('创建销售订单');

// 获取统计
const stats = contextManager.getStats();
console.log('KV缓存命中率:', stats.kvCache.hitRate);
console.log('压缩比:', stats.compression.ratio);
```

### 与现有Agent引擎集成

```typescript
// 在Agent引擎中使用
class IndustrialAgent {
  private contextManager: ContextManager;
  
  async executeTask(task: string) {
    // 初始化上下文
    this.contextManager.setObjective(task);
    
    while (!this.isTaskComplete()) {
      // 获取当前状态的推荐prefill
      const state = this.determineState();
      const payload = this.contextManager.getMessagesForAPI(state);
      
      // 调用LLM
      const response = await this.llm.chat({
        messages: payload.messages,
        prefill: payload.prefill
      });
      
      // 执行工具
      const result = await this.executeTool(response.toolCall);
      
      // 更新上下文
      this.contextManager.addToolResult(
        response.toolCall.name,
        result,
        { type: 'api_response' }
      );
    }
  }
}
```

---

## 性能指标

### 关键指标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| KV缓存命中率 | >90% | 最重要的单一指标 |
| 上下文压缩比 | >50:1 | 保持可恢复性 |
| 错误恢复率 | >80% | Agent成熟度指标 |
| 平均工具调用次数 | ~50 | Manus的典型值 |

### 成本节约

假设每月100万次请求：

| 方案 | 缓存命中率 | 月成本 |
|------|-----------|--------|
| 传统动态工具 | ~20% | $8,000 |
| Manus方案 | ~95% | $1,150 |
| **节约** | - | **$6,850 (85%)** |

---

## 参考资料

1. [Context Engineering for AI Agents: Lessons from Building Manus](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus)
2. [Why Manus Agents Don't Break the Cache](https://medium.com/@pur4v/why-manus-agents-dont-break-the-cache-and-yours-probably-do)
3. [Anthropic Multi-Agent Research System](https://www.anthropic.com/engineering/multi-agent-research-system)

---

## 更新日志

- 2025-01-01: 初始版本，基于Manus官方博客和技术分析
