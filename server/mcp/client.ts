/**
 * MCP (Model Context Protocol) 客户端模块
 * 用于与外部MCP服务器通信，调用外部工具
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// MCP工具定义
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, {
      type: string;
      description?: string;
      required?: boolean;
    }>;
    required?: string[];
  };
}

// MCP工具调用结果
export interface MCPToolResult {
  success: boolean;
  content?: any;
  error?: string;
  isError?: boolean;
}

// MCP服务器配置
export interface MCPServerConfig {
  name: string;
  displayName: string;
  description: string;
  enabled: boolean;
}

// 已配置的MCP服务器列表
const MCP_SERVERS: MCPServerConfig[] = [
  {
    name: 'notion',
    displayName: 'Notion',
    description: '文档管理、知识库创建和项目文档管理',
    enabled: true
  }
];

/**
 * 获取可用的MCP服务器列表
 */
export function getAvailableMCPServers(): MCPServerConfig[] {
  return MCP_SERVERS.filter(s => s.enabled);
}

/**
 * 列出指定MCP服务器的可用工具
 */
export async function listMCPTools(serverName: string): Promise<MCPTool[]> {
  try {
    const { stdout } = await execAsync(
      `manus-mcp-cli tool list --server ${serverName}`,
      { timeout: 30000 }
    );
    
    // 解析输出，提取工具列表
    const tools: MCPTool[] = [];
    const lines = stdout.split('\n').filter(line => line.trim());
    
    let currentTool: Partial<MCPTool> | null = null;
    
    for (const line of lines) {
      // 简单解析，实际格式可能需要调整
      if (line.includes('Tool:') || line.includes('name:')) {
        if (currentTool?.name) {
          tools.push(currentTool as MCPTool);
        }
        currentTool = {
          name: line.split(':')[1]?.trim() || '',
          description: '',
          inputSchema: { type: 'object', properties: {} }
        };
      } else if (line.includes('description:') && currentTool) {
        currentTool.description = line.split(':').slice(1).join(':').trim();
      }
    }
    
    if (currentTool?.name) {
      tools.push(currentTool as MCPTool);
    }
    
    return tools;
  } catch (error) {
    console.error(`Failed to list MCP tools for ${serverName}:`, error);
    return [];
  }
}

/**
 * 调用MCP工具
 */
export async function callMCPTool(
  serverName: string,
  toolName: string,
  params: Record<string, any>
): Promise<MCPToolResult> {
  try {
    // 构建命令
    const inputJson = JSON.stringify(params);
    const command = `manus-mcp-cli tool call ${toolName} --server ${serverName} --input '${inputJson.replace(/'/g, "'\\''")}'`;
    
    console.log(`[MCP] Calling tool: ${serverName}/${toolName}`);
    console.log(`[MCP] Params:`, params);
    
    const { stdout, stderr } = await execAsync(command, { 
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024 // 10MB
    });
    
    if (stderr && !stdout) {
      return {
        success: false,
        error: stderr,
        isError: true
      };
    }
    
    // 尝试解析JSON结果
    try {
      const result = JSON.parse(stdout);
      return {
        success: true,
        content: result
      };
    } catch {
      // 如果不是JSON，返回原始文本
      return {
        success: true,
        content: stdout.trim()
      };
    }
  } catch (error: any) {
    console.error(`[MCP] Tool call failed:`, error);
    return {
      success: false,
      error: error.message || String(error),
      isError: true
    };
  }
}

/**
 * MCP工具包装器 - 用于Agent工具调用
 */
export class MCPToolWrapper {
  private serverName: string;
  private toolName: string;
  private description: string;

  constructor(serverName: string, toolName: string, description: string) {
    this.serverName = serverName;
    this.toolName = toolName;
    this.description = description;
  }

  getName(): string {
    return `mcp_${this.serverName}_${this.toolName}`;
  }

  getDisplayName(): string {
    return `${this.serverName}/${this.toolName}`;
  }

  getDescription(): string {
    return this.description;
  }

  async execute(params: Record<string, any>): Promise<MCPToolResult> {
    return callMCPTool(this.serverName, this.toolName, params);
  }
}

/**
 * 发现并注册所有MCP工具
 */
export async function discoverMCPTools(): Promise<MCPToolWrapper[]> {
  const wrappers: MCPToolWrapper[] = [];
  
  for (const server of getAvailableMCPServers()) {
    try {
      const tools = await listMCPTools(server.name);
      for (const tool of tools) {
        wrappers.push(new MCPToolWrapper(
          server.name,
          tool.name,
          tool.description || `${server.displayName} - ${tool.name}`
        ));
      }
    } catch (error) {
      console.error(`Failed to discover tools from ${server.name}:`, error);
    }
  }
  
  return wrappers;
}

/**
 * Notion MCP 专用工具函数
 */
export const notionMCP = {
  /**
   * 搜索Notion页面
   */
  async searchPages(query: string): Promise<MCPToolResult> {
    return callMCPTool('notion', 'search_pages', { query });
  },

  /**
   * 获取页面内容
   */
  async getPage(pageId: string): Promise<MCPToolResult> {
    return callMCPTool('notion', 'get_page', { page_id: pageId });
  },

  /**
   * 创建页面
   */
  async createPage(parentId: string, title: string, content?: string): Promise<MCPToolResult> {
    return callMCPTool('notion', 'create_page', {
      parent_id: parentId,
      title,
      content
    });
  },

  /**
   * 更新页面
   */
  async updatePage(pageId: string, content: string): Promise<MCPToolResult> {
    return callMCPTool('notion', 'update_page', {
      page_id: pageId,
      content
    });
  },

  /**
   * 查询数据库
   */
  async queryDatabase(databaseId: string, filter?: Record<string, any>): Promise<MCPToolResult> {
    return callMCPTool('notion', 'query_database', {
      database_id: databaseId,
      filter
    });
  }
};

export default {
  getAvailableMCPServers,
  listMCPTools,
  callMCPTool,
  discoverMCPTools,
  MCPToolWrapper,
  notionMCP
};
