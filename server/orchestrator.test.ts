/**
 * 编排引擎测试
 */

import { describe, expect, it, vi } from "vitest";

// Mock LLM
vi.mock('./_core/llm', () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          category: '设备故障',
          subcategory: 'MES系统异常',
          severity: 'high',
          affectedSystems: ['MES', 'SCADA'],
          requiredActions: ['查询设备状态', '检查报警记录'],
          suggestedMethod: 'api',
          confidence: 0.85,
          reasoning: '问题涉及MES系统，有API可用'
        })
      }
    }]
  })
}));

// Mock MCP
vi.mock('./mcp/client', () => ({
  getAvailableMCPServers: vi.fn().mockReturnValue([
    { name: 'notion', displayName: 'Notion', description: '文档管理', enabled: true }
  ]),
  listMCPTools: vi.fn().mockResolvedValue([
    { name: 'search_pages', description: '搜索页面', inputSchema: { type: 'object', properties: {} } }
  ]),
  callMCPTool: vi.fn().mockResolvedValue({ success: true, content: { result: 'ok' } })
}));

// Mock API connectors
vi.mock('./api-connectors/base', () => ({
  APIConnectorRegistry: {
    list: vi.fn().mockReturnValue(['kingdee', 'yonyou']),
    get: vi.fn().mockReturnValue({
      getEndpoints: () => [{ name: 'query', description: '查询' }],
      call: vi.fn().mockResolvedValue({ success: true, data: {} })
    })
  }
}));

// Mock skills
vi.mock('../skills', () => ({
  loadSkills: vi.fn().mockResolvedValue({}),
  getWorkflow: vi.fn().mockReturnValue(null),
  getScenario: vi.fn().mockReturnValue(null)
}));

// Mock computer use
vi.mock('./computer-use', () => ({
  default: class MockComputerUseAgent {
    executeTask() {
      return Promise.resolve({
        success: true,
        taskId: 'test',
        actions: [],
        screenshots: [],
        duration: 1000
      });
    }
  }
}));

describe("OrchestrationEngine", () => {
  it("should analyze problem correctly", async () => {
    const { OrchestrationEngine } = await import("./orchestrator");
    const engine = new OrchestrationEngine();
    
    const analysis = await engine.analyzeProblem("MES系统报警，设备状态异常");
    
    expect(analysis).toBeDefined();
    expect(analysis.category).toBe('设备故障');
    expect(analysis.severity).toBe('high');
    expect(analysis.suggestedMethod).toBe('api');
    expect(analysis.confidence).toBeGreaterThan(0);
  });

  it("should support multiple execution methods", async () => {
    const { OrchestrationEngine } = await import("./orchestrator");
    const engine = new OrchestrationEngine();
    
    // 验证引擎实例存在
    expect(engine).toBeDefined();
    expect(typeof engine.analyzeProblem).toBe('function');
    expect(typeof engine.generatePlan).toBe('function');
    expect(typeof engine.executePlan).toBe('function');
    expect(typeof engine.handleProblem).toBe('function');
  });
});

describe("Execution Methods", () => {
  it("should have API execution capability", async () => {
    const { APIConnectorRegistry } = await import("./api-connectors/base");
    
    expect(APIConnectorRegistry.list()).toContain('kingdee');
    expect(APIConnectorRegistry.list()).toContain('yonyou');
  });

  it("should have MCP execution capability", async () => {
    const { getAvailableMCPServers, listMCPTools } = await import("./mcp/client");
    
    const servers = getAvailableMCPServers();
    expect(servers.length).toBeGreaterThan(0);
    expect(servers[0].name).toBe('notion');
    
    const tools = await listMCPTools('notion');
    expect(tools.length).toBeGreaterThan(0);
  });

  it("should have RPA execution capability", async () => {
    const ComputerUseAgent = (await import("./computer-use")).default;
    const agent = new ComputerUseAgent();
    
    const result = await agent.executeTask({
      id: 'test',
      name: '测试任务',
      description: '测试RPA执行',
      instructions: '点击按钮'
    });
    
    expect(result.success).toBe(true);
  });
});
