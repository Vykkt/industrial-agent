/**
 * 多模型LLM客户端
 * 统一接口调用不同提供商的API
 */

import axios, { AxiosError } from 'axios';
import { invokeLLM } from '../_core/llm';
import {
  ModelProvider,
  ModelConfig,
  LLMCallParams,
  LLMResponse,
  ChatMessage,
  Tool,
  PROVIDERS,
  getProviderConfig,
} from './providers';

// API Key存储（内存中，实际应用应使用数据库或环境变量）
const apiKeyStore: Map<ModelProvider, string> = new Map();

/**
 * 设置提供商的API Key
 */
export function setApiKey(provider: ModelProvider, apiKey: string): void {
  apiKeyStore.set(provider, apiKey);
}

/**
 * 获取提供商的API Key
 */
export function getApiKey(provider: ModelProvider): string | undefined {
  // 优先从环境变量获取
  const envKey = getEnvApiKey(provider);
  if (envKey) return envKey;
  
  // 从内存存储获取
  return apiKeyStore.get(provider);
}

/**
 * 从环境变量获取API Key
 */
function getEnvApiKey(provider: ModelProvider): string | undefined {
  const envNames: Record<ModelProvider, string> = {
    deepseek: 'DEEPSEEK_API_KEY',
    qwen: 'QWEN_API_KEY',
    doubao: 'DOUBAO_API_KEY',
    glm: 'GLM_API_KEY',
    minimax: 'MINIMAX_API_KEY',
    claude: 'CLAUDE_API_KEY',
    openai: 'OPENAI_API_KEY',
    gemini: 'GEMINI_API_KEY',
    builtin: '', // 内置模型不需要API Key
  };
  
  const envName = envNames[provider];
  return envName ? process.env[envName] : undefined;
}

/**
 * 检查提供商是否已配置
 */
export function isProviderConfigured(provider: ModelProvider): boolean {
  if (provider === 'builtin') return true;
  return !!getApiKey(provider);
}

/**
 * 获取已配置的提供商列表
 */
export function getConfiguredProviders(): ModelProvider[] {
  const providers: ModelProvider[] = ['builtin'];
  
  for (const provider of Object.keys(PROVIDERS) as ModelProvider[]) {
    if (provider !== 'builtin' && isProviderConfigured(provider)) {
      providers.push(provider);
    }
  }
  
  return providers;
}

/**
 * 多模型LLM客户端类
 */
export class MultiModelLLMClient {
  private config: ModelConfig;

  constructor(config: ModelConfig) {
    this.config = config;
  }

  /**
   * 调用LLM
   */
  async call(params: LLMCallParams): Promise<LLMResponse> {
    const { provider } = this.config;

    // 使用内置模型
    if (provider === 'builtin') {
      return this.callBuiltin(params);
    }

    // 获取API Key
    const apiKey = this.config.apiKey || getApiKey(provider);
    if (!apiKey) {
      throw new Error(`未配置 ${provider} 的 API Key`);
    }

    // 根据提供商调用不同的API
    const providerConfig = getProviderConfig(provider);
    
    switch (providerConfig.requestFormat) {
      case 'openai':
        return this.callOpenAIFormat(params, apiKey);
      case 'anthropic':
        return this.callAnthropicFormat(params, apiKey);
      case 'google':
        return this.callGoogleFormat(params, apiKey);
      default:
        return this.callOpenAIFormat(params, apiKey);
    }
  }

  /**
   * 调用内置模型
   */
  private async callBuiltin(params: LLMCallParams): Promise<LLMResponse> {
    const llmParams: Record<string, unknown> = {
      messages: params.messages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : 
          m.content.map(p => p.type === 'text' ? p.text : '').join(''),
      })),
      tools: params.tools,
      tool_choice: params.tool_choice,
      max_tokens: params.max_tokens,
      temperature: params.temperature,
    };

    // 只有json_schema类型才传递response_format
    if (params.response_format?.type === 'json_schema' && params.response_format.json_schema) {
      llmParams.response_format = params.response_format;
    }

    const response = await invokeLLM(llmParams as Parameters<typeof invokeLLM>[0]);

    return response as LLMResponse;
  }

  /**
   * 调用OpenAI格式API（DeepSeek, Qwen, 豆包, GLM, MiniMax, OpenAI）
   */
  private async callOpenAIFormat(params: LLMCallParams, apiKey: string): Promise<LLMResponse> {
    const providerConfig = getProviderConfig(this.config.provider);
    const baseUrl = this.config.baseUrl || providerConfig.baseUrl;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // 设置认证头
    if (providerConfig.authHeader === 'Authorization') {
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else {
      headers[providerConfig.authHeader] = apiKey;
    }

    const requestBody: Record<string, unknown> = {
      model: this.config.model,
      messages: params.messages,
      max_tokens: params.max_tokens || this.config.maxTokens,
      temperature: params.temperature ?? this.config.temperature ?? 0.7,
    };

    if (params.tools && params.tools.length > 0) {
      requestBody.tools = params.tools;
      requestBody.tool_choice = params.tool_choice || 'auto';
    }

    if (params.response_format) {
      requestBody.response_format = params.response_format;
    }

    try {
      const response = await axios.post(
        `${baseUrl}/chat/completions`,
        requestBody,
        { headers, timeout: 120000 }
      );

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorData = axiosError.response?.data as { error?: { message?: string } } | undefined;
      throw new Error(
        `${this.config.provider} API调用失败: ${
          errorData?.error?.message || axiosError.message
        }`
      );
    }
  }

  /**
   * 调用Anthropic格式API（Claude）
   */
  private async callAnthropicFormat(params: LLMCallParams, apiKey: string): Promise<LLMResponse> {
    const providerConfig = getProviderConfig(this.config.provider);
    const baseUrl = this.config.baseUrl || providerConfig.baseUrl;

    // 转换消息格式
    const systemMessage = params.messages.find(m => m.role === 'system');
    const otherMessages = params.messages.filter(m => m.role !== 'system');

    const anthropicMessages = otherMessages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: typeof m.content === 'string' ? m.content :
        m.content.map(p => {
          if (p.type === 'text') {
            return { type: 'text', text: p.text };
          } else if (p.type === 'image_url') {
            return {
              type: 'image',
              source: {
                type: 'url',
                url: p.image_url?.url,
              },
            };
          }
          return { type: 'text', text: '' };
        }),
    }));

    const requestBody: Record<string, unknown> = {
      model: this.config.model,
      messages: anthropicMessages,
      max_tokens: params.max_tokens || this.config.maxTokens || 4096,
    };

    if (systemMessage) {
      requestBody.system = typeof systemMessage.content === 'string' 
        ? systemMessage.content 
        : systemMessage.content.map(p => p.type === 'text' ? p.text : '').join('');
    }

    if (params.tools && params.tools.length > 0) {
      requestBody.tools = params.tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
    }

    try {
      const response = await axios.post(
        `${baseUrl}/messages`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          timeout: 120000,
        }
      );

      // 转换响应格式为OpenAI格式
      const data = response.data;
      return {
        id: data.id,
        model: data.model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: data.content.map((c: { type: string; text?: string }) => 
              c.type === 'text' ? c.text : ''
            ).join(''),
            tool_calls: data.content
              .filter((c: { type: string }) => c.type === 'tool_use')
              .map((c: { id: string; name: string; input: unknown }) => ({
                id: c.id,
                type: 'function',
                function: {
                  name: c.name,
                  arguments: JSON.stringify(c.input),
                },
              })),
          },
          finish_reason: data.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
        }],
        usage: {
          prompt_tokens: data.usage?.input_tokens || 0,
          completion_tokens: data.usage?.output_tokens || 0,
          total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        },
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorData = axiosError.response?.data as { error?: { message?: string } } | undefined;
      throw new Error(
        `Claude API调用失败: ${errorData?.error?.message || axiosError.message}`
      );
    }
  }

  /**
   * 调用Google格式API（Gemini）
   */
  private async callGoogleFormat(params: LLMCallParams, apiKey: string): Promise<LLMResponse> {
    const providerConfig = getProviderConfig(this.config.provider);
    const baseUrl = this.config.baseUrl || providerConfig.baseUrl;

    // 转换消息格式
    const systemInstruction = params.messages.find(m => m.role === 'system');
    const otherMessages = params.messages.filter(m => m.role !== 'system');

    const geminiContents = otherMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: typeof m.content === 'string' 
        ? [{ text: m.content }]
        : m.content.map(p => {
            if (p.type === 'text') {
              return { text: p.text };
            } else if (p.type === 'image_url' && p.image_url?.url) {
              // 处理base64图片
              if (p.image_url.url.startsWith('data:')) {
                const [mimeType, base64Data] = p.image_url.url.split(';base64,');
                return {
                  inline_data: {
                    mime_type: mimeType.replace('data:', ''),
                    data: base64Data,
                  },
                };
              }
              return { text: `[Image: ${p.image_url.url}]` };
            }
            return { text: '' };
          }),
    }));

    const requestBody: Record<string, unknown> = {
      contents: geminiContents,
      generationConfig: {
        maxOutputTokens: params.max_tokens || this.config.maxTokens || 8192,
        temperature: params.temperature ?? this.config.temperature ?? 0.7,
      },
    };

    if (systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{
          text: typeof systemInstruction.content === 'string'
            ? systemInstruction.content
            : systemInstruction.content.map(p => p.type === 'text' ? p.text : '').join(''),
        }],
      };
    }

    if (params.tools && params.tools.length > 0) {
      requestBody.tools = [{
        functionDeclarations: params.tools.map(t => ({
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters,
        })),
      }];
    }

    try {
      const response = await axios.post(
        `${baseUrl}/models/${this.config.model}:generateContent?key=${apiKey}`,
        requestBody,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 120000,
        }
      );

      // 转换响应格式为OpenAI格式
      const data = response.data;
      const candidate = data.candidates?.[0];
      const content = candidate?.content;

      let textContent = '';
      const toolCalls: { id: string; type: 'function'; function: { name: string; arguments: string } }[] = [];

      if (content?.parts) {
        for (const part of content.parts) {
          if (part.text) {
            textContent += part.text;
          }
          if (part.functionCall) {
            toolCalls.push({
              id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              type: 'function',
              function: {
                name: part.functionCall.name,
                arguments: JSON.stringify(part.functionCall.args),
              },
            });
          }
        }
      }

      return {
        id: `gemini_${Date.now()}`,
        model: this.config.model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: textContent,
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
          },
          finish_reason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
        }],
        usage: {
          prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
          completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
          total_tokens: data.usageMetadata?.totalTokenCount || 0,
        },
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorData = axiosError.response?.data as { error?: { message?: string } } | undefined;
      throw new Error(
        `Gemini API调用失败: ${errorData?.error?.message || axiosError.message}`
      );
    }
  }
}

/**
 * 创建LLM客户端
 */
export function createLLMClient(config: ModelConfig): MultiModelLLMClient {
  return new MultiModelLLMClient(config);
}

/**
 * 快速调用LLM（使用默认配置）
 */
export async function quickLLMCall(
  provider: ModelProvider,
  model: string,
  params: LLMCallParams
): Promise<LLMResponse> {
  const client = createLLMClient({ provider, model });
  return client.call(params);
}
