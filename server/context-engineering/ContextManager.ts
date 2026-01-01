/**
 * 上下文工程核心模块 - Context Engineering Core Module
 * 
 * 基于Manus的上下文工程最佳实践实现：
 * 1. KV缓存优化 - 保持上下文前缀稳定，实现10倍成本差异
 * 2. 状态机工具管理 - 通过logits masking而非删除工具
 * 3. 文件系统作为外部记忆 - 实现100:1压缩比
 * 4. 注意力操控 - 通过todo.md等机制引导模型关注
 * 5. 错误保留 - 保留错误信息帮助模型学习
 * 6. 避免few-shot陷阱 - 引入结构化变异
 */

import { v4 as uuidv4 } from 'uuid';

// ============ 类型定义 ============

/**
 * 上下文消息类型
 */
export interface ContextMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  timestamp?: number;
}

/**
 * 工具定义
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  category: string; // 工具分类前缀，如 'browser_', 'shell_', 'file_'
}

/**
 * 上下文状态
 */
export interface ContextState {
  sessionId: string;
  messages: ContextMessage[];
  tools: ToolDefinition[];
  currentPhase: string;
  cacheBreakpoints: number[];
  compressionRatio: number;
  kvCacheHitRate: number;
}

/**
 * 工具可用性状态
 */
export type ToolAvailability = 'auto' | 'required' | 'specified';

/**
 * Prefill配置
 */
export interface PrefillConfig {
  mode: ToolAvailability;
  toolPrefix?: string; // 如 'browser_', 'shell_'
  specificTool?: string; // 如 'browser_navigate'
}

// ============ KV缓存优化器 ============

/**
 * KV缓存优化器
 * 
 * 核心原则：
 * 1. 保持prompt前缀稳定 - 避免在系统提示开头包含时间戳
 * 2. 上下文只追加不修改 - 确保序列化确定性
 * 3. 显式标记缓存断点 - 支持手动缓存管理
 */
export class KVCacheOptimizer {
  private cacheBreakpoints: number[] = [];
  private lastContextHash: string = '';
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  /**
   * 计算上下文哈希（用于检测缓存失效）
   */
  private computeContextHash(messages: ContextMessage[]): string {
    // 使用确定性序列化
    const serialized = messages.map(m => 
      JSON.stringify(m, Object.keys(m).sort())
    ).join('|');
    
    // 简单哈希函数
    let hash = 0;
    for (let i = 0; i < serialized.length; i++) {
      const char = serialized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * 检查是否可以命中KV缓存
   * 
   * 关键点：
   * - 相同前缀的上下文可以利用KV缓存
   * - 即使单个token的差异也会使缓存失效
   * - Claude Sonnet: 缓存token $0.30/MTok vs 非缓存 $3/MTok = 10倍差异
   */
  checkCacheHit(messages: ContextMessage[], previousMessages: ContextMessage[]): boolean {
    if (previousMessages.length === 0) {
      this.cacheMisses++;
      return false;
    }

    // 检查前缀是否完全匹配
    for (let i = 0; i < previousMessages.length; i++) {
      const prev = previousMessages[i];
      const curr = messages[i];
      
      if (!curr || 
          prev.role !== curr.role || 
          prev.content !== curr.content ||
          prev.name !== curr.name) {
        this.cacheMisses++;
        return false;
      }
    }

    this.cacheHits++;
    return true;
  }

  /**
   * 优化系统提示以最大化缓存命中
   * 
   * 最佳实践：
   * 1. 不要在开头包含时间戳（特别是精确到秒的）
   * 2. 将动态内容放在用户消息中而非系统提示
   * 3. 使用确定性序列化
   */
  optimizeSystemPrompt(basePrompt: string, dynamicContent?: Record<string, string>): string {
    // 基础提示保持稳定
    let optimizedPrompt = basePrompt;

    // 动态内容通过特殊标记注入，但放在提示末尾
    if (dynamicContent) {
      const dynamicSection = Object.entries(dynamicContent)
        .map(([key, value]) => `<${key}>${value}</${key}>`)
        .join('\n');
      
      optimizedPrompt += `\n\n<dynamic_context>\n${dynamicSection}\n</dynamic_context>`;
    }

    return optimizedPrompt;
  }

  /**
   * 添加缓存断点
   * 
   * 用于不支持自动增量前缀缓存的模型提供商
   */
  addCacheBreakpoint(messageIndex: number): void {
    if (!this.cacheBreakpoints.includes(messageIndex)) {
      this.cacheBreakpoints.push(messageIndex);
      this.cacheBreakpoints.sort((a, b) => a - b);
    }
  }

  /**
   * 获取缓存命中率
   */
  getCacheHitRate(): number {
    const total = this.cacheHits + this.cacheMisses;
    return total > 0 ? this.cacheHits / total : 0;
  }

  /**
   * 确保JSON序列化的确定性
   * 
   * 问题：许多编程语言不保证JSON对象键的顺序
   * 解决：使用排序后的键进行序列化
   */
  deterministicSerialize(obj: any): string {
    return JSON.stringify(obj, (key, value) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.keys(value).sort().reduce((sorted: any, k) => {
          sorted[k] = value[k];
          return sorted;
        }, {});
      }
      return value;
    });
  }

  /**
   * 获取缓存统计
   */
  getStats(): { hits: number; misses: number; hitRate: number } {
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: this.getCacheHitRate()
    };
  }
}

// ============ 状态机工具管理器 ============

/**
 * 状态机工具管理器
 * 
 * 核心原则：Mask, Don't Remove
 * 
 * 问题：
 * 1. 动态添加/删除工具会使KV缓存失效
 * 2. 当之前的action引用了已删除的工具时，模型会困惑
 * 
 * 解决方案：
 * 1. 保持所有工具定义不变
 * 2. 通过logits masking控制工具可用性
 * 3. 使用response prefill约束动作选择
 */
export class StateMachineToolManager {
  private tools: Map<string, ToolDefinition> = new Map();
  private toolCategories: Map<string, string[]> = new Map();
  private currentState: string = 'idle';

  /**
   * 注册工具
   * 
   * 设计原则：工具名称使用一致的前缀
   * - browser_ 开头：浏览器相关工具
   * - shell_ 开头：命令行工具
   * - file_ 开头：文件操作工具
   * - search_ 开头：搜索工具
   */
  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
    
    // 按分类组织工具
    const category = tool.category || tool.name.split('_')[0];
    if (!this.toolCategories.has(category)) {
      this.toolCategories.set(category, []);
    }
    this.toolCategories.get(category)!.push(tool.name);
  }

  /**
   * 获取所有工具定义（始终返回完整列表）
   * 
   * 关键：永远不要删除工具，只通过masking控制
   */
  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * 生成Prefill字符串
   * 
   * 三种模式（使用Hermes格式示例）：
   * 
   * 1. Auto - 模型可以选择调用或不调用函数
   *    Prefill: <|im_start|>assistant
   * 
   * 2. Required - 模型必须调用函数，但选择不受限
   *    Prefill: <|im_start|>assistant<tool_call>
   * 
   * 3. Specified - 模型必须从特定子集中调用函数
   *    Prefill: <|im_start|>assistant<tool_call>{"name": "browser_
   */
  generatePrefill(config: PrefillConfig): string {
    const basePrefix = '<|im_start|>assistant';
    
    switch (config.mode) {
      case 'auto':
        // 模型可以选择调用或不调用
        return basePrefix;
      
      case 'required':
        // 必须调用函数，但不限制具体哪个
        return `${basePrefix}<tool_call>`;
      
      case 'specified':
        // 必须调用特定类别或特定工具
        if (config.specificTool) {
          return `${basePrefix}<tool_call>{"name": "${config.specificTool}"`;
        } else if (config.toolPrefix) {
          return `${basePrefix}<tool_call>{"name": "${config.toolPrefix}`;
        }
        return `${basePrefix}<tool_call>`;
      
      default:
        return basePrefix;
    }
  }

  /**
   * 生成OpenAI格式的Prefill
   */
  generateOpenAIPrefill(config: PrefillConfig): { role: string; content: string } | null {
    switch (config.mode) {
      case 'auto':
        return null; // 不需要prefill
      
      case 'required':
        return {
          role: 'assistant',
          content: ''
        };
      
      case 'specified':
        if (config.specificTool) {
          return {
            role: 'assistant',
            content: `<tool_call>{"name": "${config.specificTool}"`
          };
        } else if (config.toolPrefix) {
          return {
            role: 'assistant',
            content: `<tool_call>{"name": "${config.toolPrefix}`
          };
        }
        return null;
      
      default:
        return null;
    }
  }

  /**
   * 生成Logit Bias配置
   * 
   * 用于直接操控token的logits：
   * - 正值：增加该token被选中的概率
   * - 负值：降低该token被选中的概率
   * - -100：几乎完全阻止该token
   */
  generateLogitBias(
    allowedCategories: string[],
    tokenEncoder: (text: string) => number[]
  ): Record<string, number> {
    const logitBias: Record<string, number> = {};
    
    for (const [toolName, tool] of this.tools) {
      const category = tool.category || toolName.split('_')[0];
      const tokenIds = tokenEncoder(toolName);
      
      if (tokenIds.length > 0) {
        const firstTokenId = tokenIds[0];
        
        if (allowedCategories.includes(category)) {
          // 提升允许的工具
          logitBias[firstTokenId.toString()] = 15;
        } else {
          // 阻止不允许的工具
          logitBias[firstTokenId.toString()] = -100;
        }
      }
    }
    
    return logitBias;
  }

  /**
   * 根据当前状态获取推荐的Prefill配置
   */
  getRecommendedPrefill(state: string): PrefillConfig {
    // 状态机定义
    const stateConfigs: Record<string, PrefillConfig> = {
      // 用户刚输入，必须直接回复
      'user_input': { mode: 'auto' },
      
      // 需要浏览器操作
      'browsing': { mode: 'specified', toolPrefix: 'browser_' },
      
      // 需要执行命令
      'executing': { mode: 'specified', toolPrefix: 'shell_' },
      
      // 需要文件操作
      'file_operation': { mode: 'specified', toolPrefix: 'file_' },
      
      // 需要搜索
      'searching': { mode: 'specified', toolPrefix: 'search_' },
      
      // 必须调用工具但不限制类型
      'tool_required': { mode: 'required' },
      
      // 空闲状态
      'idle': { mode: 'auto' }
    };
    
    return stateConfigs[state] || { mode: 'auto' };
  }

  /**
   * 更新状态机状态
   */
  setState(newState: string): void {
    this.currentState = newState;
  }

  /**
   * 获取当前状态
   */
  getState(): string {
    return this.currentState;
  }
}

// ============ 上下文压缩管理器 ============

/**
 * 上下文压缩管理器
 * 
 * 核心原则：Use the File System as Context
 * 
 * 问题：
 * 1. 观察结果可能很大（网页、PDF等）
 * 2. 模型性能在超过一定长度后会下降
 * 3. 长输入成本高
 * 
 * 解决方案：
 * 1. 将文件系统作为无限外部记忆
 * 2. 压缩策略必须是可恢复的
 * 3. 保留URL/路径，内容可以按需重新获取
 */
export class ContextCompressor {
  private compressionRatio: number = 1;
  private originalSize: number = 0;
  private compressedSize: number = 0;

  /**
   * 压缩观察结果
   * 
   * 策略：
   * 1. 网页内容 -> 保留URL，删除内容
   * 2. 文件内容 -> 保留路径，删除内容
   * 3. 长文本 -> 保留摘要和关键信息
   */
  compressObservation(observation: string, metadata: {
    type: 'webpage' | 'file' | 'text' | 'api_response';
    url?: string;
    path?: string;
  }): { compressed: string; canRestore: boolean } {
    this.originalSize += observation.length;
    
    let compressed: string;
    let canRestore = false;

    switch (metadata.type) {
      case 'webpage':
        // 网页：保留URL，可以重新获取
        compressed = `[Webpage content from ${metadata.url} - ${observation.length} chars, can be re-fetched]`;
        canRestore = true;
        break;
      
      case 'file':
        // 文件：保留路径，可以重新读取
        compressed = `[File content from ${metadata.path} - ${observation.length} chars, can be re-read]`;
        canRestore = true;
        break;
      
      case 'api_response':
        // API响应：保留关键字段
        try {
          const parsed = JSON.parse(observation);
          compressed = JSON.stringify(this.extractKeyFields(parsed));
          canRestore = false;
        } catch {
          compressed = observation.substring(0, 500) + '...';
          canRestore = false;
        }
        break;
      
      default:
        // 普通文本：截断
        if (observation.length > 1000) {
          compressed = observation.substring(0, 500) + '\n...[truncated]...\n' + observation.substring(observation.length - 500);
          canRestore = false;
        } else {
          compressed = observation;
          canRestore = true;
        }
    }

    this.compressedSize += compressed.length;
    this.compressionRatio = this.originalSize / this.compressedSize;

    return { compressed, canRestore };
  }

  /**
   * 提取关键字段
   */
  private extractKeyFields(obj: any, depth: number = 0): any {
    if (depth > 2) return '[nested object]';
    
    if (Array.isArray(obj)) {
      if (obj.length > 5) {
        return [...obj.slice(0, 3).map(item => this.extractKeyFields(item, depth + 1)), `... and ${obj.length - 3} more items`];
      }
      return obj.map(item => this.extractKeyFields(item, depth + 1));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const result: any = {};
      const keys = Object.keys(obj);
      const importantKeys = ['id', 'name', 'status', 'error', 'message', 'result', 'data'];
      
      for (const key of keys) {
        if (importantKeys.includes(key) || keys.length <= 5) {
          result[key] = this.extractKeyFields(obj[key], depth + 1);
        }
      }
      
      if (Object.keys(result).length < keys.length) {
        result['_omitted'] = `${keys.length - Object.keys(result).length} fields`;
      }
      
      return result;
    }
    
    if (typeof obj === 'string' && obj.length > 200) {
      return obj.substring(0, 100) + '...' + obj.substring(obj.length - 100);
    }
    
    return obj;
  }

  /**
   * 获取压缩统计
   */
  getStats(): { originalSize: number; compressedSize: number; ratio: number } {
    return {
      originalSize: this.originalSize,
      compressedSize: this.compressedSize,
      ratio: this.compressionRatio
    };
  }
}

// ============ 注意力操控器 ============

/**
 * 注意力操控器
 * 
 * 核心原则：Manipulate Attention Through Recitation
 * 
 * 问题：
 * - 长上下文中模型容易偏离主题或忘记早期目标
 * - "lost-in-the-middle" 问题
 * 
 * 解决方案：
 * - 通过不断重写todo列表，将全局计划推送到上下文末尾
 * - 使用自然语言引导模型关注任务目标
 */
export class AttentionManipulator {
  private todoList: string[] = [];
  private completedItems: string[] = [];
  private currentObjective: string = '';

  /**
   * 设置当前目标
   */
  setObjective(objective: string): void {
    this.currentObjective = objective;
  }

  /**
   * 添加待办事项
   */
  addTodoItem(item: string): void {
    this.todoList.push(item);
  }

  /**
   * 标记完成
   */
  markComplete(item: string): void {
    const index = this.todoList.indexOf(item);
    if (index > -1) {
      this.todoList.splice(index, 1);
      this.completedItems.push(item);
    }
  }

  /**
   * 生成todo.md内容
   * 
   * 这个文件会被追加到上下文末尾，
   * 帮助模型保持对任务目标的关注
   */
  generateTodoMarkdown(): string {
    let content = `# Current Task\n\n`;
    content += `**Objective:** ${this.currentObjective}\n\n`;
    
    content += `## Progress\n\n`;
    
    if (this.completedItems.length > 0) {
      content += `### Completed\n`;
      this.completedItems.forEach(item => {
        content += `- [x] ${item}\n`;
      });
      content += '\n';
    }
    
    if (this.todoList.length > 0) {
      content += `### Remaining\n`;
      this.todoList.forEach(item => {
        content += `- [ ] ${item}\n`;
      });
    }
    
    return content;
  }

  /**
   * 生成注意力引导消息
   */
  generateAttentionGuide(): string {
    const remaining = this.todoList.length;
    const completed = this.completedItems.length;
    const total = remaining + completed;
    
    return `[Progress: ${completed}/${total} tasks completed. Current focus: ${this.todoList[0] || 'Task complete'}]`;
  }
}

// ============ 错误保留管理器 ============

/**
 * 错误保留管理器
 * 
 * 核心原则：Keep the Wrong Stuff In
 * 
 * 问题：
 * - 常见冲动是隐藏错误：清理trace、重试action、重置状态
 * - 但这会移除证据，模型无法从中学习
 * 
 * 解决方案：
 * - 保留错误的action和observation在上下文中
 * - 让模型看到失败的action和结果，隐式更新其内部信念
 * - 错误恢复是真正agent行为的最清晰指标
 */
export class ErrorRetentionManager {
  private errorHistory: Array<{
    action: string;
    error: string;
    timestamp: number;
    recovered: boolean;
  }> = [];

  /**
   * 记录错误
   */
  recordError(action: string, error: string): void {
    this.errorHistory.push({
      action,
      error,
      timestamp: Date.now(),
      recovered: false
    });
  }

  /**
   * 标记错误已恢复
   */
  markRecovered(action: string): void {
    const lastError = this.errorHistory.find(
      e => e.action === action && !e.recovered
    );
    if (lastError) {
      lastError.recovered = true;
    }
  }

  /**
   * 生成错误上下文
   * 
   * 这个内容会被保留在上下文中，帮助模型避免重复同样的错误
   */
  generateErrorContext(): string {
    if (this.errorHistory.length === 0) return '';
    
    let context = '\n<previous_errors>\n';
    
    // 只保留最近的5个错误
    const recentErrors = this.errorHistory.slice(-5);
    
    for (const error of recentErrors) {
      context += `Action: ${error.action}\n`;
      context += `Error: ${error.error}\n`;
      context += `Status: ${error.recovered ? 'Recovered' : 'Unresolved'}\n`;
      context += '---\n';
    }
    
    context += '</previous_errors>\n';
    
    return context;
  }

  /**
   * 获取错误统计
   */
  getStats(): { total: number; recovered: number; recoveryRate: number } {
    const total = this.errorHistory.length;
    const recovered = this.errorHistory.filter(e => e.recovered).length;
    return {
      total,
      recovered,
      recoveryRate: total > 0 ? recovered / total : 0
    };
  }
}

// ============ Few-Shot陷阱避免器 ============

/**
 * Few-Shot陷阱避免器
 * 
 * 核心原则：Don't Get Few-Shotted
 * 
 * 问题：
 * - 模型会模仿上下文中的行为模式
 * - 如果上下文充满相似的action-observation对，模型会遵循该模式
 * - 这在重复性任务中特别危险，导致漂移、过度泛化或幻觉
 * 
 * 解决方案：
 * - 引入结构化变异
 * - 不同的序列化模板、替代措辞、格式上的轻微噪声
 * - 打破模式，调整模型注意力
 */
export class FewShotTrapAvoider {
  private serializationTemplates: string[] = [
    'Action: {action}\nResult: {result}',
    '[{action}] → {result}',
    '执行 {action}，返回 {result}',
    'Executed {action}. Output: {result}',
    '{action} completed with: {result}'
  ];

  private phrasingVariants: Map<string, string[]> = new Map([
    ['success', ['completed successfully', 'done', 'finished', 'executed', '成功']],
    ['error', ['failed', 'error occurred', 'unsuccessful', 'exception', '失败']],
    ['processing', ['working on', 'handling', 'processing', 'executing', '处理中']]
  ]);

  /**
   * 使用随机模板序列化action-observation对
   */
  serializeWithVariation(action: string, result: string): string {
    const templateIndex = Math.floor(Math.random() * this.serializationTemplates.length);
    const template = this.serializationTemplates[templateIndex];
    
    return template
      .replace('{action}', action)
      .replace('{result}', result);
  }

  /**
   * 获取措辞变体
   */
  getPhrasingVariant(key: string): string {
    const variants = this.phrasingVariants.get(key);
    if (!variants) return key;
    
    const index = Math.floor(Math.random() * variants.length);
    return variants[index];
  }

  /**
   * 添加轻微格式噪声
   */
  addFormatNoise(text: string): string {
    const noiseOptions = [
      () => text, // 无变化
      () => text.trim(), // 去除空格
      () => text + ' ', // 添加尾部空格
      () => '  ' + text, // 添加前导空格
    ];
    
    const index = Math.floor(Math.random() * noiseOptions.length);
    return noiseOptions[index]();
  }
}

// ============ 主上下文管理器 ============

/**
 * 主上下文管理器
 * 
 * 整合所有上下文工程组件
 */
export class ContextManager {
  private kvCacheOptimizer: KVCacheOptimizer;
  private toolManager: StateMachineToolManager;
  private compressor: ContextCompressor;
  private attentionManipulator: AttentionManipulator;
  private errorRetention: ErrorRetentionManager;
  private fewShotAvoider: FewShotTrapAvoider;
  
  private sessionId: string;
  private messages: ContextMessage[] = [];
  private systemPrompt: string = '';

  constructor() {
    this.sessionId = uuidv4();
    this.kvCacheOptimizer = new KVCacheOptimizer();
    this.toolManager = new StateMachineToolManager();
    this.compressor = new ContextCompressor();
    this.attentionManipulator = new AttentionManipulator();
    this.errorRetention = new ErrorRetentionManager();
    this.fewShotAvoider = new FewShotTrapAvoider();
  }

  /**
   * 初始化系统提示
   * 
   * 注意：不要在开头包含时间戳！
   */
  initializeSystemPrompt(basePrompt: string): void {
    this.systemPrompt = this.kvCacheOptimizer.optimizeSystemPrompt(basePrompt);
    
    this.messages = [{
      role: 'system',
      content: this.systemPrompt
    }];
  }

  /**
   * 添加用户消息
   */
  addUserMessage(content: string): void {
    this.messages.push({
      role: 'user',
      content,
      timestamp: Date.now()
    });
  }

  /**
   * 添加助手消息（工具调用）
   */
  addAssistantToolCall(toolName: string, args: Record<string, any>): void {
    const serialized = this.kvCacheOptimizer.deterministicSerialize({
      name: toolName,
      arguments: args
    });
    
    this.messages.push({
      role: 'assistant',
      content: `<tool_call>${serialized}</tool_call>`
    });
  }

  /**
   * 添加工具结果
   */
  addToolResult(
    toolCallId: string, 
    result: string, 
    metadata: { type: 'webpage' | 'file' | 'text' | 'api_response'; url?: string; path?: string }
  ): void {
    // 压缩观察结果
    const { compressed } = this.compressor.compressObservation(result, metadata);
    
    // 使用变体序列化
    const serialized = this.fewShotAvoider.serializeWithVariation(
      toolCallId,
      compressed
    );
    
    this.messages.push({
      role: 'tool',
      content: serialized,
      tool_call_id: toolCallId
    });
  }

  /**
   * 添加错误
   */
  addError(action: string, error: string): void {
    this.errorRetention.recordError(action, error);
    
    // 错误也作为tool result添加到上下文
    this.messages.push({
      role: 'tool',
      content: `Error: ${error}`,
      tool_call_id: action
    });
  }

  /**
   * 获取用于API调用的消息
   */
  getMessagesForAPI(state: string): {
    messages: ContextMessage[];
    prefill: { role: string; content: string } | null;
    logitBias?: Record<string, number>;
  } {
    // 获取推荐的prefill配置
    const prefillConfig = this.toolManager.getRecommendedPrefill(state);
    const prefill = this.toolManager.generateOpenAIPrefill(prefillConfig);
    
    // 添加注意力引导
    const attentionGuide = this.attentionManipulator.generateAttentionGuide();
    
    // 添加错误上下文
    const errorContext = this.errorRetention.generateErrorContext();
    
    // 构建最终消息列表
    const finalMessages = [...this.messages];
    
    // 在最后一条用户消息后添加上下文增强
    if (attentionGuide || errorContext) {
      const lastUserIndex = finalMessages.findLastIndex(m => m.role === 'user');
      if (lastUserIndex > -1) {
        finalMessages[lastUserIndex] = {
          ...finalMessages[lastUserIndex],
          content: finalMessages[lastUserIndex].content + '\n\n' + attentionGuide + errorContext
        };
      }
    }
    
    return {
      messages: finalMessages,
      prefill
    };
  }

  /**
   * 注册工具
   */
  registerTool(tool: ToolDefinition): void {
    this.toolManager.registerTool(tool);
  }

  /**
   * 设置任务目标
   */
  setObjective(objective: string): void {
    this.attentionManipulator.setObjective(objective);
  }

  /**
   * 添加待办事项
   */
  addTodoItem(item: string): void {
    this.attentionManipulator.addTodoItem(item);
  }

  /**
   * 标记待办完成
   */
  markTodoComplete(item: string): void {
    this.attentionManipulator.markComplete(item);
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    kvCache: { hits: number; misses: number; hitRate: number };
    compression: { originalSize: number; compressedSize: number; ratio: number };
    errors: { total: number; recovered: number; recoveryRate: number };
    messageCount: number;
  } {
    return {
      kvCache: this.kvCacheOptimizer.getStats(),
      compression: this.compressor.getStats(),
      errors: this.errorRetention.getStats(),
      messageCount: this.messages.length
    };
  }
}

// 导出所有组件
export {
  KVCacheOptimizer,
  StateMachineToolManager,
  ContextCompressor,
  AttentionManipulator,
  ErrorRetentionManager,
  FewShotTrapAvoider
};
