/**
 * 多模型API提供商配置和接入框架
 * 支持: DeepSeek, Qwen, 豆包, GLM, MiniMax, Claude, GPT, Gemini
 */

// 模型提供商类型
export type ModelProvider = 
  | 'deepseek'
  | 'qwen'
  | 'doubao'
  | 'glm'
  | 'minimax'
  | 'claude'
  | 'openai'
  | 'gemini'
  | 'builtin';

// 模型配置
export interface ModelConfig {
  provider: ModelProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

// 提供商配置
export interface ProviderConfig {
  name: string;
  displayName: string;
  baseUrl: string;
  models: {
    id: string;
    name: string;
    maxTokens: number;
    supportVision?: boolean;
    supportTools?: boolean;
  }[];
  authHeader: string;
  requestFormat: 'openai' | 'anthropic' | 'google' | 'custom';
}

// 所有支持的提供商配置
export const PROVIDERS: Record<ModelProvider, ProviderConfig> = {
  deepseek: {
    name: 'deepseek',
    displayName: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat', maxTokens: 64000, supportVision: false, supportTools: true },
      { id: 'deepseek-coder', name: 'DeepSeek Coder', maxTokens: 64000, supportVision: false, supportTools: true },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (R1)', maxTokens: 64000, supportVision: false, supportTools: true },
    ],
    authHeader: 'Authorization',
    requestFormat: 'openai',
  },
  qwen: {
    name: 'qwen',
    displayName: '通义千问 (Qwen)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: [
      { id: 'qwen-turbo', name: 'Qwen Turbo', maxTokens: 8000, supportVision: false, supportTools: true },
      { id: 'qwen-plus', name: 'Qwen Plus', maxTokens: 32000, supportVision: false, supportTools: true },
      { id: 'qwen-max', name: 'Qwen Max', maxTokens: 32000, supportVision: false, supportTools: true },
      { id: 'qwen-vl-plus', name: 'Qwen VL Plus', maxTokens: 8000, supportVision: true, supportTools: false },
      { id: 'qwen-vl-max', name: 'Qwen VL Max', maxTokens: 32000, supportVision: true, supportTools: true },
    ],
    authHeader: 'Authorization',
    requestFormat: 'openai',
  },
  doubao: {
    name: 'doubao',
    displayName: '豆包 (Doubao)',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    models: [
      { id: 'doubao-pro-32k', name: '豆包 Pro 32K', maxTokens: 32000, supportVision: false, supportTools: true },
      { id: 'doubao-pro-128k', name: '豆包 Pro 128K', maxTokens: 128000, supportVision: false, supportTools: true },
      { id: 'doubao-lite-32k', name: '豆包 Lite 32K', maxTokens: 32000, supportVision: false, supportTools: true },
      { id: 'doubao-vision-pro-32k', name: '豆包 Vision Pro', maxTokens: 32000, supportVision: true, supportTools: true },
    ],
    authHeader: 'Authorization',
    requestFormat: 'openai',
  },
  glm: {
    name: 'glm',
    displayName: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: [
      { id: 'glm-4', name: 'GLM-4', maxTokens: 128000, supportVision: false, supportTools: true },
      { id: 'glm-4-plus', name: 'GLM-4 Plus', maxTokens: 128000, supportVision: false, supportTools: true },
      { id: 'glm-4-air', name: 'GLM-4 Air', maxTokens: 128000, supportVision: false, supportTools: true },
      { id: 'glm-4v', name: 'GLM-4V', maxTokens: 8000, supportVision: true, supportTools: true },
      { id: 'glm-4v-plus', name: 'GLM-4V Plus', maxTokens: 8000, supportVision: true, supportTools: true },
    ],
    authHeader: 'Authorization',
    requestFormat: 'openai',
  },
  minimax: {
    name: 'minimax',
    displayName: 'MiniMax',
    baseUrl: 'https://api.minimax.chat/v1',
    models: [
      { id: 'abab6.5s-chat', name: 'ABAB 6.5S', maxTokens: 245760, supportVision: false, supportTools: true },
      { id: 'abab6.5g-chat', name: 'ABAB 6.5G', maxTokens: 8192, supportVision: false, supportTools: true },
      { id: 'abab5.5s-chat', name: 'ABAB 5.5S', maxTokens: 16384, supportVision: false, supportTools: true },
    ],
    authHeader: 'Authorization',
    requestFormat: 'openai',
  },
  claude: {
    name: 'claude',
    displayName: 'Claude (Anthropic)',
    baseUrl: 'https://api.anthropic.com/v1',
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', maxTokens: 200000, supportVision: true, supportTools: true },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', maxTokens: 200000, supportVision: true, supportTools: true },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', maxTokens: 200000, supportVision: true, supportTools: true },
    ],
    authHeader: 'x-api-key',
    requestFormat: 'anthropic',
  },
  openai: {
    name: 'openai',
    displayName: 'OpenAI GPT',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', maxTokens: 128000, supportVision: true, supportTools: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', maxTokens: 128000, supportVision: true, supportTools: true },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', maxTokens: 128000, supportVision: true, supportTools: true },
      { id: 'o1-preview', name: 'O1 Preview', maxTokens: 128000, supportVision: false, supportTools: false },
      { id: 'o1-mini', name: 'O1 Mini', maxTokens: 128000, supportVision: false, supportTools: false },
    ],
    authHeader: 'Authorization',
    requestFormat: 'openai',
  },
  gemini: {
    name: 'gemini',
    displayName: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: [
      { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', maxTokens: 1048576, supportVision: true, supportTools: true },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', maxTokens: 2097152, supportVision: true, supportTools: true },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', maxTokens: 1048576, supportVision: true, supportTools: true },
    ],
    authHeader: 'x-goog-api-key',
    requestFormat: 'google',
  },
  builtin: {
    name: 'builtin',
    displayName: '内置模型 (Manus)',
    baseUrl: '', // 使用内置API
    models: [
      { id: 'default', name: '默认模型', maxTokens: 128000, supportVision: true, supportTools: true },
    ],
    authHeader: 'Authorization',
    requestFormat: 'openai',
  },
};

// 消息类型
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, {
        type: string;
        description?: string;
        enum?: string[];
      }>;
      required?: string[];
    };
  };
}

// LLM调用参数
export interface LLMCallParams {
  messages: ChatMessage[];
  tools?: Tool[];
  tool_choice?: 'none' | 'auto' | 'required' | { type: 'function'; function: { name: string } };
  max_tokens?: number;
  temperature?: number;
  response_format?: {
    type: 'text' | 'json_object' | 'json_schema';
    json_schema?: {
      name: string;
      strict?: boolean;
      schema: Record<string, unknown>;
    };
  };
}

// LLM响应
export interface LLMResponse {
  id: string;
  model: string;
  choices: {
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * 获取提供商配置
 */
export function getProviderConfig(provider: ModelProvider): ProviderConfig {
  return PROVIDERS[provider];
}

/**
 * 获取所有提供商列表
 */
export function getAllProviders(): { provider: ModelProvider; config: ProviderConfig }[] {
  return Object.entries(PROVIDERS).map(([provider, config]) => ({
    provider: provider as ModelProvider,
    config,
  }));
}

/**
 * 获取提供商的所有模型
 */
export function getProviderModels(provider: ModelProvider) {
  return PROVIDERS[provider]?.models || [];
}

/**
 * 验证API Key格式
 */
export function validateApiKey(provider: ModelProvider, apiKey: string): boolean {
  if (!apiKey || apiKey.trim() === '') return false;
  
  // 简单格式验证
  switch (provider) {
    case 'openai':
      return apiKey.startsWith('sk-');
    case 'claude':
      return apiKey.startsWith('sk-ant-');
    case 'deepseek':
      return apiKey.startsWith('sk-');
    case 'gemini':
      return apiKey.length > 20;
    default:
      return apiKey.length > 10;
  }
}
