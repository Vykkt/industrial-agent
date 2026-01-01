# Skills 目录说明

本目录包含工业智能运维Agent的技能定义、工作流模板和场景配置。

## 目录结构

```
skills/
├── README.md           # 本说明文档
├── index.ts            # 技能加载入口
├── workflows/          # 工作流定义
│   ├── erp-finance.yaml
│   ├── mes-production.yaml
│   ├── plm-design.yaml
│   ├── scada-alarm.yaml
│   └── ...
├── scenarios/          # 场景配置
│   ├── equipment-fault.yaml
│   ├── production-delay.yaml
│   ├── quality-issue.yaml
│   └── ...
├── templates/          # 提示词模板
│   ├── problem-analysis.md
│   ├── solution-generation.md
│   └── ...
└── prompts/            # 系统提示词
    ├── agent-system.md
    ├── tool-selection.md
    └── ...
```

## 技能定义格式

### 工作流 (Workflow)

工作流定义了处理特定类型问题的步骤序列：

```yaml
name: erp-finance-workflow
displayName: ERP财务问题处理流程
description: 处理ERP系统财务模块相关问题的标准流程
version: "1.0"
triggers:
  - category: erp_finance
  - keywords: ["财务", "凭证", "报表", "账务"]

steps:
  - id: analyze
    name: 问题分析
    action: llm_analyze
    prompt: prompts/problem-analysis.md
    
  - id: query_data
    name: 查询相关数据
    action: tool_call
    tools:
      - erp_query_voucher
      - erp_query_account_balance
      
  - id: diagnose
    name: 问题诊断
    action: llm_diagnose
    context:
      - analyze.result
      - query_data.result
      
  - id: solution
    name: 生成解决方案
    action: llm_generate
    prompt: prompts/solution-generation.md
```

### 场景配置 (Scenario)

场景配置定义了特定业务场景的处理策略：

```yaml
name: equipment-fault
displayName: 设备故障处理
description: 处理工厂设备故障报警的场景配置
priority: high

detection:
  keywords: ["故障", "报警", "停机", "异常"]
  systems: ["scada", "mes"]
  
tools_required:
  - scada_query_alarms
  - scada_query_device_status
  - mes_query_production_order
  - knowledge_search

knowledge_domains:
  - equipment_manual
  - fault_case
  - troubleshooting

response_template: |
  ## 故障分析报告
  
  ### 设备信息
  {device_info}
  
  ### 报警详情
  {alarm_details}
  
  ### 可能原因
  {possible_causes}
  
  ### 建议措施
  {recommended_actions}
```

## 使用方式

### 加载技能

```typescript
import { loadSkills, getWorkflow, getScenario } from './skills';

// 加载所有技能
const skills = await loadSkills();

// 获取特定工作流
const workflow = getWorkflow('erp-finance-workflow');

// 根据问题匹配场景
const scenario = matchScenario(problemDescription);
```

### 执行工作流

```typescript
import { executeWorkflow } from './skills';

const result = await executeWorkflow('erp-finance-workflow', {
  ticketId: 123,
  problem: "财务凭证无法生成",
  context: { ... }
});
```

## 扩展技能

1. 在相应目录下创建新的YAML配置文件
2. 遵循上述格式定义工作流或场景
3. 重启服务或调用技能重载接口

## MCP集成

Skills支持通过MCP协议调用外部工具：

```yaml
steps:
  - id: external_query
    name: 调用外部服务
    action: mcp_call
    server: notion
    tool: search_pages
    params:
      query: "{problem_keywords}"
```
