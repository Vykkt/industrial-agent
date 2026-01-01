# 工业AI智能体改进方案 - 实施计划

## P0 第1阶段：模块解耦和配置系统（Week 1-2）

### 1.1 创建配置管理模块
- [ ] `server/config/` 目录结构
  - [ ] `ConfigManager.ts` - 配置管理核心类
  - [ ] `types.ts` - 配置类型定义
  - [ ] `schema.ts` - 配置验证schema
  - [ ] `defaults.ts` - 默认配置

### 1.2 系统配置（MES/ERP连接）
- [ ] 创建系统配置表 (drizzle schema)
  - [ ] systemConfigs 表
  - [ ] 支持字段：系统类型、API端点、认证信息、状态
- [ ] 配置API端点
  - [ ] GET /api/config/systems - 获取系统列表
  - [ ] POST /api/config/systems - 新增系统配置
  - [ ] PUT /api/config/systems/:id - 更新系统配置
  - [ ] DELETE /api/config/systems/:id - 删除系统配置
  - [ ] POST /api/config/systems/:id/test - 测试连接

### 1.3 工具配置
- [ ] 创建工具配置表 (drizzle schema)
  - [ ] toolConfigs 表
  - [ ] 支持字段：工具名称、参数定义、可用性规则、所属系统
- [ ] 工具配置API
  - [ ] GET /api/config/tools - 获取工具列表
  - [ ] POST /api/config/tools - 新增工具
  - [ ] PUT /api/config/tools/:id - 更新工具
  - [ ] DELETE /api/config/tools/:id - 删除工具

### 1.4 工作流配置
- [ ] 创建工作流配置表 (drizzle schema)
  - [ ] workflowConfigs 表
  - [ ] 支持字段：工作流名称、步骤定义、条件分支、超时设置
- [ ] 工作流配置API
  - [ ] GET /api/config/workflows - 获取工作流列表
  - [ ] POST /api/config/workflows - 新增工作流
  - [ ] PUT /api/config/workflows/:id - 更新工作流

### 1.5 前端配置页面
- [ ] 系统配置页面
  - [ ] 系统列表展示
  - [ ] 新增/编辑系统配置表单
  - [ ] 连接测试功能
- [ ] 工具配置页面
  - [ ] 工具列表展示
  - [ ] 工具参数配置
  - [ ] 工具可用性规则设置
- [ ] 工作流配置页面
  - [ ] 工作流可视化编辑器
  - [ ] 步骤和条件配置

---

## P0 第1阶段：工具虚拟化框架（Week 2-3）

### 2.1 创建工具适配器框架
- [ ] `server/tools/` 目录结构
  - [ ] `ITool.ts` - 工具接口定义
  - [ ] `ToolFactory.ts` - 工具工厂
  - [ ] `adapters/` - 适配器实现目录

### 2.2 工具接口定义
- [ ] 定义统一的Tool接口
  ```typescript
  interface ITool {
    execute(params: ToolParams): Promise<ToolResult>;
    validate(params: ToolParams): ValidationResult;
    getSchema(): ToolSchema;
    getName(): string;
    getDescription(): string;
  }
  ```

### 2.3 工具模式实现
- [ ] Mock适配器 (MockToolAdapter)
  - [ ] 返回模拟数据
  - [ ] 用于开发和测试
- [ ] API适配器 (APIToolAdapter)
  - [ ] 调用真实API
  - [ ] 支持错误处理和重试
- [ ] 工具工厂
  - [ ] 根据配置创建合适的适配器
  - [ ] 支持动态切换模式

### 2.4 工具执行层重构
- [ ] 将 `server/agent/industrial-tools.ts` 重构为使用适配器模式
- [ ] 支持三种执行模式
  - [ ] MOCK - 返回模拟数据
  - [ ] SIMULATION - 沙箱执行
  - [ ] REAL - 真实执行
- [ ] 工具执行器 (ToolExecutor)
  - [ ] 参数验证
  - [ ] 权限检查
  - [ ] 执行前/后钩子
  - [ ] 结果处理

### 2.5 错误处理和重试
- [ ] 实现重试逻辑
  - [ ] 指数退避算法
  - [ ] 最大重试次数配置
- [ ] 错误分类
  - [ ] 网络错误 (可重试)
  - [ ] 业务错误 (不可重试)
  - [ ] 验证错误 (需调整参数)

---

## P0 第2阶段：工作流持久化（Week 3-4）

### 3.1 事件溯源架构
- [ ] 创建工作流事件表 (drizzle schema)
  - [ ] workflowEvents 表
  - [ ] 字段：workflow_id, event_type, event_data, timestamp, version
- [ ] 创建工作流快照表
  - [ ] workflowSnapshots 表
  - [ ] 字段：workflow_id, state, version, created_at

### 3.2 工作流状态机
- [ ] 定义工作流状态
  - [ ] PENDING - 待执行
  - [ ] RUNNING - 执行中
  - [ ] PAUSED - 暂停
  - [ ] COMPLETED - 完成
  - [ ] FAILED - 失败
- [ ] 状态转换规则
  - [ ] 有效的状态转换定义
  - [ ] 状态转换事件记录

### 3.3 工作流持久化服务
- [ ] `server/workflow/` 目录
  - [ ] `WorkflowPersistence.ts` - 持久化服务
  - [ ] `WorkflowRecovery.ts` - 恢复服务
  - [ ] `EventStore.ts` - 事件存储
- [ ] 实现功能
  - [ ] 保存工作流事件
  - [ ] 定期创建快照
  - [ ] 从快照恢复
  - [ ] 重放事件

### 3.4 工作流恢复机制
- [ ] 支持从检查点恢复
  - [ ] 加载最新快照
  - [ ] 重放快照后的事件
  - [ ] 恢复到当前状态
- [ ] 错误恢复
  - [ ] 失败步骤重试
  - [ ] 回退到上一个检查点

### 3.5 工作流API
- [ ] GET /api/workflows/:id - 获取工作流状态
- [ ] POST /api/workflows/:id/pause - 暂停工作流
- [ ] POST /api/workflows/:id/resume - 恢复工作流
- [ ] GET /api/workflows/:id/events - 获取工作流事件历史
- [ ] GET /api/workflows/:id/snapshots - 获取快照列表

---

## P1 第3阶段：多智能体协同（Week 5-6）

### 4.1 消息队列系统
- [ ] 选择消息队列 (Redis Stream)
- [ ] 消息类型定义
  - [ ] TaskAssignment - 任务分配
  - [ ] ProgressUpdate - 进度更新
  - [ ] Result - 结果消息
  - [ ] ErrorRecovery - 错误恢复
- [ ] 消息处理器
  - [ ] 消息序列化/反序列化
  - [ ] 消息路由
  - [ ] 死信处理

### 4.2 Agent间通信协议
- [ ] `server/multi-agent/` 目录
  - [ ] `MessageBus.ts` - 消息总线
  - [ ] `AgentCoordinator.ts` - Agent协调器
  - [ ] `types.ts` - 消息类型定义
- [ ] 实现功能
  - [ ] 任务分配和委派
  - [ ] 进度跟踪
  - [ ] 结果聚合
  - [ ] 错误恢复

### 4.3 多Agent执行引擎
- [ ] Lead Agent 实现
  - [ ] 查询分析
  - [ ] 子任务分解
  - [ ] 结果综合
  - [ ] 动态调整
- [ ] Sub Agent 实现
  - [ ] 独立执行任务
  - [ ] 进度报告
  - [ ] 结果返回

### 4.4 并行执行支持
- [ ] 支持并行生成多个Sub Agent
- [ ] 支持Sub Agent并行调用工具
- [ ] 结果聚合和去重

### 4.5 API端点
- [ ] POST /api/multi-agent/tasks - 提交多Agent任务
- [ ] GET /api/multi-agent/tasks/:id - 获取任务状态
- [ ] GET /api/multi-agent/tasks/:id/progress - 获取进度
- [ ] POST /api/multi-agent/tasks/:id/cancel - 取消任务

---

## P1 第3阶段：RAG知识库检索（Week 6-7）

### 5.1 pgvector集成
- [ ] 添加pgvector扩展到PostgreSQL
- [ ] 创建知识库表 (drizzle schema)
  - [ ] knowledgeChunks 表
  - [ ] 字段：content, embedding (vector), metadata, chunk_index
- [ ] 创建索引
  - [ ] pgvector ivfflat索引
  - [ ] BM25全文索引

### 5.2 混合检索实现
- [ ] BM25检索
  - [ ] 中文分词支持
  - [ ] 关键词匹配
- [ ] 向量检索
  - [ ] 嵌入模型集成
  - [ ] 相似度计算
- [ ] 候选融合
  - [ ] 倒数融合排序 (RRF)
  - [ ] 权重调整

### 5.3 重排序机制
- [ ] 重排序模型集成
  - [ ] bge-reranker-v2-m3
  - [ ] 交叉编码器
- [ ] 重排序配置
  - [ ] top_k 设置
  - [ ] 相似度阈值
  - [ ] 融合方法选择

### 5.4 RAG检索API
- [ ] POST /api/rag/search - 执行混合检索
- [ ] POST /api/rag/rerank - 执行重排序
- [ ] GET /api/rag/config - 获取检索配置
- [ ] PUT /api/rag/config - 更新检索配置

### 5.5 前端配置页面
- [ ] 检索策略配置
  - [ ] 选择BM25/Vector/Hybrid
  - [ ] 调整权重
- [ ] 重排序配置
  - [ ] 模型选择
  - [ ] 参数调整
- [ ] 检索结果展示
  - [ ] 相似度分数
  - [ ] 来源引用

---

## 数据库Schema更新

### 新增表
```sql
-- 系统配置表
CREATE TABLE system_configs (
  id UUID PRIMARY KEY,
  system_type VARCHAR(50),
  api_endpoint VARCHAR(255),
  auth_config JSONB,
  status VARCHAR(20),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- 工具配置表
CREATE TABLE tool_configs (
  id UUID PRIMARY KEY,
  tool_name VARCHAR(100),
  tool_description TEXT,
  parameters JSONB,
  availability_rules JSONB,
  system_id UUID REFERENCES system_configs(id),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- 工作流配置表
CREATE TABLE workflow_configs (
  id UUID PRIMARY KEY,
  workflow_name VARCHAR(100),
  steps JSONB,
  conditions JSONB,
  timeout_config JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- 工作流事件表
CREATE TABLE workflow_events (
  id UUID PRIMARY KEY,
  workflow_id UUID,
  event_type VARCHAR(50),
  event_data JSONB,
  timestamp TIMESTAMP,
  version INT,
  created_at TIMESTAMP
);

-- 工作流快照表
CREATE TABLE workflow_snapshots (
  id UUID PRIMARY KEY,
  workflow_id UUID,
  state JSONB,
  version INT,
  created_at TIMESTAMP
);

-- 知识库切片表
CREATE TABLE knowledge_chunks (
  id UUID PRIMARY KEY,
  content TEXT,
  embedding vector(1536),
  metadata JSONB,
  chunk_index INT,
  created_at TIMESTAMP
);

-- 创建索引
CREATE INDEX ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX bm25_idx ON knowledge_chunks USING GIN (to_tsvector('chinese', content));
```

---

## 测试计划

### 单元测试
- [ ] 配置管理模块测试
- [ ] 工具适配器测试
- [ ] 工作流持久化测试
- [ ] 多Agent协同测试
- [ ] RAG检索测试

### 集成测试
- [ ] 端到端工作流测试
- [ ] 多Agent任务执行测试
- [ ] 知识库检索测试

### 性能测试
- [ ] 工作流恢复性能
- [ ] 多Agent并行执行性能
- [ ] 知识库检索性能

---

## 文档更新

- [ ] 架构文档
- [ ] API文档
- [ ] 配置指南
- [ ] 部署指南
- [ ] 故障排除指南

---

## 时间表

| 阶段 | 任务 | 预计时间 | 状态 |
|-----|------|--------|------|
| P0-1 | 模块解耦和配置系统 | 2周 | 待开始 |
| P0-1 | 工具虚拟化框架 | 2周 | 待开始 |
| P0-2 | 工作流持久化 | 1.5周 | 待开始 |
| P1-3 | 多智能体协同 | 2周 | 待开始 |
| P1-3 | RAG知识库检索 | 2周 | 待开始 |
| 总计 | | 9.5周 | |

