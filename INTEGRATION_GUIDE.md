# 工业AI智能体改进方案 - 集成指南

## 概述

本指南详细说明如何将改进方案集成到现有的工业AI智能体项目中。改进方案分为三个阶段，共计9.5周的实施周期。

---

## 第一部分：P0第1阶段 - 模块解耦和配置系统（第1-2周）

### 1.1 配置管理模块集成

#### 步骤1：导入新的模块

```typescript
// server/_core/index.ts 或主入口文件中
import configRoutes from "../config/routes";
import { configManager } from "../config/ConfigManager";

// 注册路由
app.use("/api/config", configRoutes);
```

#### 步骤2：初始化配置管理器

```typescript
// 在应用启动时初始化
async function initializeConfigManager() {
  try {
    // 加载默认配置
    const defaultConfigs = await configManager.listSystemConnections();
    console.log(`Loaded ${defaultConfigs.length} system connections`);
  } catch (error) {
    console.error("Failed to initialize config manager:", error);
  }
}

initializeConfigManager();
```

#### 步骤3：前端配置页面

在前端创建配置管理界面：

```typescript
// client/src/pages/SystemConfig.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function SystemConfig() {
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSystems();
  }, []);

  const loadSystems = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/config/systems");
      const data = await response.json();
      setSystems(data);
    } catch (error) {
      console.error("Failed to load systems:", error);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (id: number) => {
    try {
      const response = await fetch(`/api/config/systems/${id}/test`, {
        method: "POST",
      });
      const result = await response.json();
      alert(result.success ? "连接测试成功" : "连接测试失败");
    } catch (error) {
      console.error("Test failed:", error);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">系统配置</h1>
      {systems.map((system: any) => (
        <Card key={system.id} className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold">{system.systemName}</h3>
              <p className="text-sm text-gray-600">{system.apiEndpoint}</p>
            </div>
            <Button onClick={() => testConnection(system.id)}>测试连接</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
```

### 1.2 工具虚拟化框架集成

#### 步骤1：更新工具执行逻辑

```typescript
// server/agent/engine.ts 中的工具调用部分
import { toolExecutor } from "../tools/ToolExecutor";
import { ExecutionMode } from "../tools/ITool";

// 替换原有的工具执行逻辑
async function executeToolCall(toolName: string, params: any) {
  // 从配置中获取执行模式
  const config = await configManager.getToolConfigurationByToolId(toolId);
  const mode = config?.executionMode || ExecutionMode.MOCK;

  // 使用工具执行器执行
  const result = await toolExecutor.execute(tool, params, mode);

  return result;
}
```

#### 步骤2：注册工业工具

```typescript
// server/tools/industrial-tools.ts
import { ITool, ToolSchema, ToolParams, ToolResult, ExecutionMode } from "./ITool";

export class QueryERPOrderTool implements ITool {
  async execute(params: ToolParams, mode?: ExecutionMode): Promise<ToolResult> {
    // 实现工具逻辑
    return {
      success: true,
      data: { orderId: "ORD-001" },
    };
  }

  validate(params: ToolParams) {
    return { valid: true };
  }

  getSchema(): ToolSchema {
    return {
      name: "query_erp_order",
      description: "查询ERP系统中的订单信息",
      parameters: [
        {
          name: "orderId",
          type: "string",
          description: "订单ID",
          required: true,
        },
      ],
      returns: {
        type: "object",
        description: "订单详情",
      },
    };
  }

  getName(): string {
    return "query_erp_order";
  }

  getDescription(): string {
    return "查询ERP系统中的订单信息";
  }

  getCategory(): string {
    return "erp";
  }
}

// 注册工具
toolFactory.registerTool("query_erp_order", new QueryERPOrderTool());
```

---

## 第二部分：P0第2阶段 - 工作流持久化（第3-4周）

### 2.1 工作流引擎集成

#### 步骤1：导入工作流模块

```typescript
// server/_core/index.ts
import workflowRoutes from "../workflow/routes";
import { workflowPersistence } from "../workflow/WorkflowPersistence";
import { workflowRecovery } from "../workflow/WorkflowRecovery";

app.use("/api/workflows", workflowRoutes);
```

#### 步骤2：在工作流执行中保存事件

```typescript
// server/orchestrator/index.ts 中的工作流执行部分
import { WorkflowEventType } from "../config/types";

async function executeWorkflow(workflowId: string, params: any) {
  const executionId = nanoid();

  try {
    // 记录工作流开始事件
    await workflowPersistence.saveEvent(
      executionId,
      WorkflowEventType.STARTED,
      { timestamp: new Date(), variables: params }
    );

    // 执行工作流步骤
    for (const step of workflow.steps) {
      try {
        const result = await executeStep(step, params);

        // 记录步骤执行成功
        await workflowPersistence.saveEvent(
          executionId,
          WorkflowEventType.STEP_EXECUTED,
          {
            result,
            timestamp: new Date(),
          },
          step.id
        );
      } catch (error) {
        // 记录步骤执行失败
        await workflowPersistence.saveEvent(
          executionId,
          WorkflowEventType.STEP_FAILED,
          { timestamp: new Date() },
          step.id,
          error instanceof Error ? error.message : "Unknown error"
        );

        // 处理失败
        const recovery = await workflowRecovery.handleStepFailure(
          executionId,
          step.id,
          error instanceof Error ? error.message : "Unknown error"
        );

        if (!recovery.recovered) {
          throw error;
        }
      }
    }

    // 记录工作流完成
    await workflowPersistence.saveEvent(
      executionId,
      WorkflowEventType.COMPLETED,
      { timestamp: new Date(), result: {} }
    );
  } catch (error) {
    // 记录工作流失败
    await workflowPersistence.saveEvent(
      executionId,
      WorkflowEventType.FAILED,
      { timestamp: new Date() },
      undefined,
      error instanceof Error ? error.message : "Unknown error"
    );

    throw error;
  }
}
```

#### 步骤3：前端工作流监控

```typescript
// client/src/pages/WorkflowMonitor.tsx
import { useEffect, useState } from "react";

export default function WorkflowMonitor() {
  const [executionId, setExecutionId] = useState("");
  const [history, setHistory] = useState([]);

  const loadHistory = async () => {
    if (!executionId) return;

    try {
      const response = await fetch(`/api/workflows/${executionId}/history`);
      const data = await response.json();
      setHistory(data);
    } catch (error) {
      console.error("Failed to load history:", error);
    }
  };

  return (
    <div className="space-y-4">
      <input
        value={executionId}
        onChange={(e) => setExecutionId(e.target.value)}
        placeholder="输入工作流执行ID"
      />
      <button onClick={loadHistory}>加载历史</button>

      <div className="space-y-2">
        {history.map((event: any, index) => (
          <div key={index} className="border p-2 rounded">
            <p className="font-semibold">{event.type}</p>
            <p className="text-sm text-gray-600">{event.timestamp}</p>
            {event.error && <p className="text-red-600">{event.error}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 第三部分：P1第3阶段 - 多智能体协同（第5-6周）

### 3.1 多Agent系统集成

#### 步骤1：导入多Agent模块

```typescript
// server/_core/index.ts
import multiAgentRoutes from "../multi-agent/routes";
import { messageBus } from "../multi-agent/MessageBus";
import { agentCoordinator } from "../multi-agent/AgentCoordinator";

app.use("/api/multi-agent", multiAgentRoutes);

// 初始化消息处理器
messageBus.subscribe(AgentMessageType.TASK_ASSIGNMENT, async (message) => {
  console.log(`Task assigned to ${message.toAgentId}:`, message.messageData);
  // 处理任务分配
});

messageBus.subscribe(AgentMessageType.PROGRESS_UPDATE, async (message) => {
  console.log(`Progress from ${message.fromAgentId}:`, message.messageData);
  // 处理进度更新
});
```

#### 步骤2：实现Lead Agent

```typescript
// server/agent/lead-agent.ts
import { agentCoordinator } from "../multi-agent/AgentCoordinator";

export class LeadAgent {
  async handleComplexQuery(query: string): Promise<any> {
    // 创建Lead任务
    const task = await agentCoordinator.createLeadTask(query);

    // 分解为子任务
    const subTasks = this.decomposeQuery(query);
    const decomposition = await agentCoordinator.decomposeTask(task.taskId, subTasks);

    // 等待子任务完成
    const completion = await agentCoordinator.waitForSubTasksCompletion(task.taskId);

    // 聚合结果
    const result = await agentCoordinator.aggregateResults(task.taskId);

    return result;
  }

  private decomposeQuery(query: string) {
    // 根据查询类型分解为子任务
    return [
      {
        objective: "查询ERP系统数据",
        agentId: "erp-agent",
      },
      {
        objective: "查询MES系统数据",
        agentId: "mes-agent",
      },
      {
        objective: "查询库存数据",
        agentId: "inventory-agent",
      },
    ];
  }
}
```

#### 步骤3：前端多Agent任务界面

```typescript
// client/src/pages/MultiAgentTasks.tsx
import { useState } from "react";

export default function MultiAgentTasks() {
  const [objective, setObjective] = useState("");
  const [taskId, setTaskId] = useState("");
  const [results, setResults] = useState(null);

  const submitTask = async () => {
    try {
      const response = await fetch("/api/multi-agent/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective,
          leadAgentId: "lead-agent",
        }),
      });
      const task = await response.json();
      setTaskId(task.taskId);
    } catch (error) {
      console.error("Failed to submit task:", error);
    }
  };

  const checkResults = async () => {
    try {
      const response = await fetch(`/api/multi-agent/tasks/${taskId}/results`);
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error("Failed to check results:", error);
    }
  };

  return (
    <div className="space-y-4">
      <textarea
        value={objective}
        onChange={(e) => setObjective(e.target.value)}
        placeholder="输入任务目标"
        className="w-full border p-2"
      />
      <button onClick={submitTask}>提交任务</button>

      {taskId && (
        <div>
          <p>任务ID: {taskId}</p>
          <button onClick={checkResults}>检查结果</button>
          {results && <pre>{JSON.stringify(results, null, 2)}</pre>}
        </div>
      )}
    </div>
  );
}
```

### 3.2 RAG检索集成

#### 步骤1：导入RAG模块

```typescript
// server/_core/index.ts
import ragRoutes from "../rag/routes";

app.use("/api/rag", ragRoutes);
```

#### 步骤2：在Agent中使用RAG检索

```typescript
// server/agent/engine.ts
import { ragRetrieval } from "../rag/RAGRetrieval";

async function retrieveKnowledge(query: string): Promise<any[]> {
  // 生成查询嵌入（需要集成嵌入模型）
  const embedding = await generateEmbedding(query);

  // 执行混合检索
  const results = await ragRetrieval.search(
    embedding,
    { text: query, limit: 5 },
    { enabled: true, topK: 3 }
  );

  return results;
}
```

#### 步骤3：前端知识库检索界面

```typescript
// client/src/pages/KnowledgeSearch.tsx
import { useState } from "react";

export default function KnowledgeSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  const search = async () => {
    try {
      const response = await fetch("/api/rag/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          embedding: [], // 需要生成实际的嵌入
          limit: 10,
          rerank: { enabled: true, topK: 5 },
        }),
      });
      const data = await response.json();
      setResults(data.results);
    } catch (error) {
      console.error("Search failed:", error);
    }
  };

  return (
    <div className="space-y-4">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜索知识库..."
        className="w-full border p-2"
      />
      <button onClick={search}>搜索</button>

      <div className="space-y-2">
        {results.map((result: any, index) => (
          <div key={index} className="border p-2 rounded">
            <p className="font-semibold">相关度: {(result.score * 100).toFixed(1)}%</p>
            <p className="text-sm">{result.content.substring(0, 200)}...</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 数据库迁移

### 步骤1：生成迁移文件

```bash
# 在项目根目录运行
pnpm db:push
```

这将自动生成并执行迁移脚本，创建所有新表。

### 步骤2：验证表创建

```sql
-- 验证新表是否创建成功
SHOW TABLES LIKE '%config%';
SHOW TABLES LIKE '%workflow%';
SHOW TABLES LIKE '%agent%';
SHOW TABLES LIKE '%knowledge%';
```

---

## 测试计划

### 单元测试

```bash
# 运行所有测试
pnpm test

# 运行特定模块的测试
pnpm test server/config/ConfigManager.test.ts
pnpm test server/tools/ToolExecutor.test.ts
pnpm test server/workflow/WorkflowPersistence.test.ts
```

### 集成测试

```bash
# 启动开发服务器
pnpm dev

# 测试配置管理API
curl -X GET http://localhost:3000/api/config/systems

# 测试工具执行
curl -X POST http://localhost:3000/api/tools/execute \
  -H "Content-Type: application/json" \
  -d '{"toolName": "query_erp_order", "params": {"orderId": "ORD-001"}}'

# 测试工作流API
curl -X POST http://localhost:3000/api/workflows/events \
  -H "Content-Type: application/json" \
  -d '{"workflowExecutionId": "exec-001", "eventType": "started"}'
```

---

## 性能优化建议

### 1. 数据库索引

```sql
-- 为常用查询字段创建索引
CREATE INDEX idx_system_connections_status ON system_connections(status);
CREATE INDEX idx_workflow_events_execution_id ON workflow_events(workflowExecutionId);
CREATE INDEX idx_agent_messages_to_agent ON agent_messages(toAgentId, status);
CREATE FULLTEXT INDEX idx_knowledge_chunks_content ON knowledge_chunks(content);
```

### 2. 缓存策略

```typescript
// 使用Redis缓存配置
import redis from "redis";

const redisClient = redis.createClient();

async function getCachedConfig(key: string) {
  const cached = await redisClient.get(key);
  if (cached) {
    return JSON.parse(cached);
  }

  const config = await configManager.getSystemConnection(parseInt(key));
  await redisClient.setEx(key, 3600, JSON.stringify(config));
  return config;
}
```

### 3. 异步处理

```typescript
// 使用消息队列处理长时间运行的任务
import Bull from "bull";

const workflowQueue = new Bull("workflows");

workflowQueue.process(async (job) => {
  await executeWorkflow(job.data.workflowId, job.data.params);
});

// 提交任务到队列
await workflowQueue.add({ workflowId: "wf-001", params: {} });
```

---

## 故障排除

### 问题1：工作流恢复失败

**症状**：工作流无法从快照恢复

**解决方案**：
1. 检查快照表中是否有有效的快照数据
2. 验证事件表中的事件顺序
3. 运行清理命令：`DELETE FROM workflow_snapshots WHERE version < 10;`

### 问题2：多Agent任务超时

**症状**：子任务无法在规定时间内完成

**解决方案**：
1. 增加等待超时时间：`waitForSubTasksCompletion(taskId, 600000)`
2. 检查Agent的处理能力
3. 分析消息队列的延迟

### 问题3：RAG检索性能差

**症状**：检索结果相关度低或速度慢

**解决方案**：
1. 调整BM25和向量权重：`bm25Weight: 0.3, vectorWeight: 0.7`
2. 增加向量索引：`CREATE INDEX ON knowledge_chunks USING ivfflat (embedding);`
3. 启用重排序：`rerank: { enabled: true, topK: 5 }`

---

## 后续改进方向

### 短期（1-2个月）

- [ ] 集成真实的嵌入模型（如bge-m3）
- [ ] 实现重排序模型（如bge-reranker-v2-m3）
- [ ] 添加权限和安全控制
- [ ] 完善错误处理和日志记录

### 中期（3-6个月）

- [ ] 实现分布式工作流执行
- [ ] 支持动态工作流定义
- [ ] 添加工作流可视化编辑器
- [ ] 实现Agent自学习机制

### 长期（6-12个月）

- [ ] 支持跨系统的工作流编排
- [ ] 实现Agent的自主优化
- [ ] 构建Agent市场和生态
- [ ] 支持多模态输入（文本、语音、图像）

