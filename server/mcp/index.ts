/**
 * MCP (Model Context Protocol) 模块
 * 提供与外部MCP服务器的集成能力
 */

export {
  getAvailableMCPServers,
  listMCPTools,
  callMCPTool,
  discoverMCPTools,
  MCPToolWrapper,
  notionMCP,
  type MCPTool,
  type MCPToolResult,
  type MCPServerConfig
} from './client';

// MCP工具类别
export const MCP_TOOL_CATEGORIES = {
  DOCUMENT: 'document',      // 文档管理
  DATABASE: 'database',      // 数据库操作
  COMMUNICATION: 'communication', // 通讯协作
  STORAGE: 'storage',        // 文件存储
  ANALYTICS: 'analytics'     // 数据分析
} as const;

// MCP服务器与类别映射
export const MCP_SERVER_CATEGORIES: Record<string, string[]> = {
  notion: [MCP_TOOL_CATEGORIES.DOCUMENT, MCP_TOOL_CATEGORIES.DATABASE]
};

/**
 * 根据类别获取推荐的MCP工具
 */
export function getMCPToolsByCategory(category: string): string[] {
  const servers: string[] = [];
  for (const [server, categories] of Object.entries(MCP_SERVER_CATEGORIES)) {
    if (categories.includes(category)) {
      servers.push(server);
    }
  }
  return servers;
}

/**
 * MCP工具调用日志
 */
export interface MCPCallLog {
  id: string;
  timestamp: Date;
  server: string;
  tool: string;
  params: Record<string, any>;
  result: any;
  success: boolean;
  duration: number;
}

// 调用日志缓存
const callLogs: MCPCallLog[] = [];
const MAX_LOGS = 100;

/**
 * 记录MCP调用日志
 */
export function logMCPCall(log: Omit<MCPCallLog, 'id' | 'timestamp'>): void {
  const entry: MCPCallLog = {
    id: `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date(),
    ...log
  };
  
  callLogs.unshift(entry);
  
  // 保持日志数量在限制内
  if (callLogs.length > MAX_LOGS) {
    callLogs.pop();
  }
}

/**
 * 获取MCP调用日志
 */
export function getMCPCallLogs(limit?: number): MCPCallLog[] {
  return callLogs.slice(0, limit || MAX_LOGS);
}

/**
 * 清空MCP调用日志
 */
export function clearMCPCallLogs(): void {
  callLogs.length = 0;
}
