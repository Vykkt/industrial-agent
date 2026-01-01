/**
 * 端到端测试执行脚本
 * 运行完整的工业流程工作流并生成报告
 */

import { ERPSystem } from './mock-systems/erp-system';
import { PLMSystem } from './mock-systems/plm-system';
import { MESSystem } from './mock-systems/mes-system';
import { WarehouseSystem } from './mock-systems/warehouse-system';
import { E2EWorkflowExecutor, WorkflowExecutionReport } from './e2e-workflow';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 生成HTML报告
 */
function generateHTMLReport(report: WorkflowExecutionReport): string {
  const logs = report.logs
    .map(
      log => `
    <tr class="log-${log.status}">
      <td>${log.timestamp.toISOString()}</td>
      <td>${log.phase}</td>
      <td>${log.agent}</td>
      <td>${log.action}</td>
      <td><span class="status-${log.status}">${log.status.toUpperCase()}</span></td>
      <td>${log.error || (log.details ? JSON.stringify(log.details) : '')}</td>
    </tr>
  `
    )
    .join('\n');

  const duration = report.summary.duration ? (report.summary.duration / 1000).toFixed(2) : 'N/A';

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>工业AI智能体端到端工作流测试报告</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      min-height: 100vh;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    
    .header h1 {
      font-size: 28px;
      margin-bottom: 10px;
    }
    
    .header p {
      font-size: 14px;
      opacity: 0.9;
    }
    
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      padding: 30px;
      background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
    }
    
    .summary-item {
      text-align: center;
    }
    
    .summary-item .value {
      font-size: 32px;
      font-weight: bold;
      color: #667eea;
      margin-bottom: 5px;
    }
    
    .summary-item .label {
      font-size: 14px;
      color: #666;
    }
    
    .content {
      padding: 30px;
    }
    
    .section-title {
      font-size: 18px;
      font-weight: bold;
      color: #333;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #667eea;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    
    th {
      background: #f0f0f0;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      font-size: 13px;
      color: #333;
      border-bottom: 2px solid #ddd;
    }
    
    td {
      padding: 12px;
      border-bottom: 1px solid #eee;
      font-size: 13px;
    }
    
    tr:hover {
      background: #f9f9f9;
    }
    
    .status-success {
      background: #d4edda;
      color: #155724;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 600;
    }
    
    .status-error {
      background: #f8d7da;
      color: #721c24;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 600;
    }
    
    .status-warning {
      background: #fff3cd;
      color: #856404;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 600;
    }
    
    .log-success {
      background: #f0f8f4;
    }
    
    .log-error {
      background: #fef5f5;
    }
    
    .log-warning {
      background: #fffaf0;
    }
    
    .footer {
      background: #f8f9fa;
      padding: 20px 30px;
      border-top: 1px solid #e0e0e0;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
    
    .status-badge {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: 600;
      margin-bottom: 20px;
    }
    
    .status-badge.completed {
      background: #d4edda;
      color: #155724;
    }
    
    .status-badge.failed {
      background: #f8d7da;
      color: #721c24;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏭 工业AI智能体端到端工作流测试报告</h1>
      <p>涡旋产品从订单到发货的完整流程</p>
    </div>
    
    <div class="summary">
      <div class="summary-item">
        <div class="value">${report.summary.totalPhases}</div>
        <div class="label">总阶段数</div>
      </div>
      <div class="summary-item">
        <div class="value">${report.summary.completedPhases}</div>
        <div class="label">完成阶段</div>
      </div>
      <div class="summary-item">
        <div class="value">${report.summary.failedPhases}</div>
        <div class="label">失败阶段</div>
      </div>
      <div class="summary-item">
        <div class="value">${duration}s</div>
        <div class="label">执行时间</div>
      </div>
    </div>
    
    <div class="content">
      <div class="status-badge ${report.status === 'completed' ? 'completed' : 'failed'}">
        ${report.status === 'completed' ? '✓ 工作流完成' : '✗ 工作流失败'}
      </div>
      
      <div class="section-title">📋 执行日志</div>
      <table>
        <thead>
          <tr>
            <th>时间戳</th>
            <th>阶段</th>
            <th>Agent</th>
            <th>操作</th>
            <th>状态</th>
            <th>详情</th>
          </tr>
        </thead>
        <tbody>
          ${logs}
        </tbody>
      </table>
      
      <div class="section-title">📊 执行统计</div>
      <table>
        <thead>
          <tr>
            <th>指标</th>
            <th>值</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>工作流ID</td>
            <td>${report.workflowId}</td>
          </tr>
          <tr>
            <td>开始时间</td>
            <td>${report.startTime.toISOString()}</td>
          </tr>
          <tr>
            <td>结束时间</td>
            <td>${report.endTime ? report.endTime.toISOString() : 'N/A'}</td>
          </tr>
          <tr>
            <td>执行状态</td>
            <td><span class="status-${report.status}">${report.status.toUpperCase()}</span></td>
          </tr>
          <tr>
            <td>总日志数</td>
            <td>${report.logs.length}</td>
          </tr>
          <tr>
            <td>成功日志</td>
            <td>${report.logs.filter(l => l.status === 'success').length}</td>
          </tr>
          <tr>
            <td>错误日志</td>
            <td>${report.logs.filter(l => l.status === 'error').length}</td>
          </tr>
          <tr>
            <td>警告日志</td>
            <td>${report.logs.filter(l => l.status === 'warning').length}</td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <div class="footer">
      <p>报告生成时间: ${new Date().toISOString()}</p>
      <p>工业AI智能体测试平台 v1.0</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * 生成JSON报告
 */
function generateJSONReport(report: WorkflowExecutionReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * 生成Markdown报告
 */
function generateMarkdownReport(report: WorkflowExecutionReport): string {
  const duration = report.summary.duration ? (report.summary.duration / 1000).toFixed(2) : 'N/A';

  let markdown = `# 工业AI智能体端到端工作流测试报告

## 执行概览

- **工作流ID**: ${report.workflowId}
- **执行状态**: ${report.status.toUpperCase()}
- **开始时间**: ${report.startTime.toISOString()}
- **结束时间**: ${report.endTime ? report.endTime.toISOString() : 'N/A'}
- **执行时间**: ${duration}秒

## 执行统计

| 指标 | 值 |
|-----|-----|
| 总阶段数 | ${report.summary.totalPhases} |
| 完成阶段 | ${report.summary.completedPhases} |
| 失败阶段 | ${report.summary.failedPhases} |
| 总日志数 | ${report.logs.length} |
| 成功日志 | ${report.logs.filter(l => l.status === 'success').length} |
| 错误日志 | ${report.logs.filter(l => l.status === 'error').length} |
| 警告日志 | ${report.logs.filter(l => l.status === 'warning').length} |

## 执行日志

| 时间戳 | 阶段 | Agent | 操作 | 状态 | 详情 |
|-------|------|-------|------|------|------|
`;

  report.logs.forEach(log => {
    const details = log.error || (log.details ? JSON.stringify(log.details) : '');
    markdown += `| ${log.timestamp.toISOString()} | ${log.phase} | ${log.agent} | ${log.action} | ${log.status} | ${details} |\n`;
  });

  markdown += `

## 工作流阶段

### 阶段1: 销售订单 (ERP)
- 创建客户销售订单
- 确认销售订单

### 阶段2: 生产订单 (ERP)
- 根据销售订单创建生产订单

### 阶段3: BOM设计和修改 (PLM)
- 获取原始BOM
- 修改机油物料号（MAT-OIL-001 → MAT-OIL-002）
- 修改电机型号（MAT-MOTOR-001 → MAT-MOTOR-002）
- 发布修改后的BOM

### 阶段4: 采购订单 (ERP)
- 根据修改后的BOM创建采购订单

### 阶段5: 生产执行 (MES)
- 创建工作订单
- 安排工作订单
- 开始生产
- 执行7个生产任务：
  - 组装电机
  - 安装转子
  - 安装定子
  - 加注冷冻油
  - 安装外壳
  - 安装轴承
  - 最终组装
- 完成生产

### 阶段6: 质量检测 (MES)
- 进货检测
- 过程检测
- 最终检测

### 阶段7: 发货 (仓库)
- 创建发货单
- 开始拣货
- 完成拣货
- 发货
- 确认送达

## 结论

${report.status === 'completed' ? '✓ 工作流成功完成！所有阶段都已按预期执行。' : '✗ 工作流执行失败。请查看错误日志进行排查。'}
`;

  return markdown;
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log('========================================');
  console.log('工业AI智能体端到端工作流测试');
  console.log('========================================\n');

  try {
    // 初始化系统
    const erp = new ERPSystem();
    const plm = new PLMSystem();
    const mes = new MESSystem();
    const warehouse = new WarehouseSystem();

    // 创建工作流执行器
    const executor = new E2EWorkflowExecutor(erp, plm, mes, warehouse);

    // 执行工作流
    const report = await executor.executeWorkflow();

    // 生成报告
    const reportDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const reportBaseName = `e2e-workflow-${timestamp}`;

    // 保存HTML报告
    const htmlReport = generateHTMLReport(report);
    const htmlPath = path.join(reportDir, `${reportBaseName}.html`);
    fs.writeFileSync(htmlPath, htmlReport);
    console.log(`\n✓ HTML报告已保存: ${htmlPath}`);

    // 保存JSON报告
    const jsonReport = generateJSONReport(report);
    const jsonPath = path.join(reportDir, `${reportBaseName}.json`);
    fs.writeFileSync(jsonPath, jsonReport);
    console.log(`✓ JSON报告已保存: ${jsonPath}`);

    // 保存Markdown报告
    const markdownReport = generateMarkdownReport(report);
    const mdPath = path.join(reportDir, `${reportBaseName}.md`);
    fs.writeFileSync(mdPath, markdownReport);
    console.log(`✓ Markdown报告已保存: ${mdPath}`);

    // 输出总结
    console.log('\n========================================');
    console.log('测试完成');
    console.log('========================================');
    console.log(`工作流ID: ${report.workflowId}`);
    console.log(`执行状态: ${report.status}`);
    console.log(`完成阶段: ${report.summary.completedPhases}/${report.summary.totalPhases}`);
    console.log(`执行时间: ${report.summary.duration ? (report.summary.duration / 1000).toFixed(2) : 'N/A'}秒`);
    console.log(`总日志数: ${report.logs.length}`);
    console.log('========================================\n');
  } catch (error) {
    console.error('测试执行失败:', error);
    process.exit(1);
  }
}

// 运行测试
main().catch(console.error);
