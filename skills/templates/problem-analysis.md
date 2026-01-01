# 问题分析模板

## 输入
- 问题描述：{problem_description}
- 问题类别：{category}
- 优先级：{priority}
- 上下文信息：{context}

## 分析任务

请对上述问题进行全面分析，输出以下内容：

### 1. 问题理解
- 问题的核心是什么？
- 涉及哪些系统或模块？
- 问题的表现形式是什么？

### 2. 关键信息提取
- 时间信息（发生时间、持续时间）
- 位置信息（设备、产线、部门）
- 对象信息（单据号、用户、产品）
- 数值信息（数量、金额、参数）

### 3. 影响评估
- 对业务的影响程度
- 影响的范围和人员
- 是否有时间紧迫性

### 4. 初步判断
- 可能的原因类别
- 需要查询的数据
- 需要调用的工具

## 输出格式

```json
{
  "problem_summary": "问题简述",
  "system": "涉及系统",
  "module": "涉及模块",
  "key_info": {
    "time": "时间信息",
    "location": "位置信息",
    "object": "对象信息",
    "value": "数值信息"
  },
  "impact": {
    "level": "high/medium/low",
    "scope": "影响范围",
    "urgency": "紧急程度"
  },
  "initial_analysis": {
    "possible_causes": ["原因1", "原因2"],
    "required_data": ["数据1", "数据2"],
    "suggested_tools": ["工具1", "工具2"]
  }
}
```
