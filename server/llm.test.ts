/**
 * LLM模块测试
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  PROVIDERS,
  getAllProviders,
  getProviderConfig,
  getProviderModels,
  validateApiKey,
  ModelProvider,
} from "./llm/providers";
import {
  setApiKey,
  getApiKey,
  isProviderConfigured,
  getConfiguredProviders,
  createLLMClient,
} from "./llm/client";

describe("LLM Providers", () => {
  it("should have all required providers configured", () => {
    const requiredProviders: ModelProvider[] = [
      'deepseek', 'qwen', 'doubao', 'glm', 'minimax', 'claude', 'openai', 'gemini', 'builtin'
    ];
    
    for (const provider of requiredProviders) {
      expect(PROVIDERS[provider]).toBeDefined();
      expect(PROVIDERS[provider].name).toBe(provider);
      expect(PROVIDERS[provider].displayName).toBeTruthy();
      expect(PROVIDERS[provider].models.length).toBeGreaterThan(0);
    }
  });

  it("should return all providers with getAllProviders", () => {
    const providers = getAllProviders();
    expect(providers.length).toBe(9); // 9个提供商
    
    for (const { provider, config } of providers) {
      expect(config.name).toBe(provider);
    }
  });

  it("should return correct provider config", () => {
    const deepseekConfig = getProviderConfig('deepseek');
    expect(deepseekConfig.name).toBe('deepseek');
    expect(deepseekConfig.displayName).toBe('DeepSeek');
    expect(deepseekConfig.baseUrl).toBe('https://api.deepseek.com/v1');
    expect(deepseekConfig.requestFormat).toBe('openai');
  });

  it("should return provider models", () => {
    const qwenModels = getProviderModels('qwen');
    expect(qwenModels.length).toBeGreaterThan(0);
    expect(qwenModels.some(m => m.id === 'qwen-turbo')).toBe(true);
  });

  it("should validate API key format", () => {
    // OpenAI格式
    expect(validateApiKey('openai', 'sk-1234567890')).toBe(true);
    expect(validateApiKey('openai', 'invalid')).toBe(false);
    
    // Claude格式
    expect(validateApiKey('claude', 'sk-ant-1234567890')).toBe(true);
    expect(validateApiKey('claude', 'sk-1234567890')).toBe(false);
    
    // 通用验证
    expect(validateApiKey('qwen', 'some-valid-key-12345')).toBe(true);
    expect(validateApiKey('qwen', '')).toBe(false);
  });
});

describe("LLM Client", () => {
  beforeEach(() => {
    // 清理API Key存储
    vi.resetModules();
  });

  it("should set and get API key", () => {
    setApiKey('deepseek', 'sk-test-key-12345');
    expect(getApiKey('deepseek')).toBe('sk-test-key-12345');
  });

  it("should check if provider is configured", () => {
    // builtin总是已配置
    expect(isProviderConfigured('builtin')).toBe(true);
  });

  it("should return configured providers", () => {
    const configured = getConfiguredProviders();
    expect(configured).toContain('builtin');
  });

  it("should create LLM client", () => {
    const client = createLLMClient({
      provider: 'builtin',
      model: 'default'
    });
    expect(client).toBeDefined();
    expect(typeof client.call).toBe('function');
  });

  it("should throw error for unconfigured provider", async () => {
    const client = createLLMClient({
      provider: 'deepseek',
      model: 'deepseek-chat'
    });
    
    // 未设置API Key应该抛出错误
    await expect(client.call({
      messages: [{ role: 'user', content: 'test' }]
    })).rejects.toThrow();
  });
});

describe("Provider Request Formats", () => {
  it("should have correct request format for each provider", () => {
    expect(PROVIDERS.deepseek.requestFormat).toBe('openai');
    expect(PROVIDERS.qwen.requestFormat).toBe('openai');
    expect(PROVIDERS.doubao.requestFormat).toBe('openai');
    expect(PROVIDERS.glm.requestFormat).toBe('openai');
    expect(PROVIDERS.minimax.requestFormat).toBe('openai');
    expect(PROVIDERS.openai.requestFormat).toBe('openai');
    expect(PROVIDERS.claude.requestFormat).toBe('anthropic');
    expect(PROVIDERS.gemini.requestFormat).toBe('google');
  });

  it("should have correct auth headers", () => {
    expect(PROVIDERS.openai.authHeader).toBe('Authorization');
    expect(PROVIDERS.claude.authHeader).toBe('x-api-key');
    expect(PROVIDERS.gemini.authHeader).toBe('x-goog-api-key');
  });
});

describe("Model Capabilities", () => {
  it("should have vision support info for models", () => {
    const gpt4oModels = PROVIDERS.openai.models.filter(m => m.id === 'gpt-4o');
    expect(gpt4oModels[0]?.supportVision).toBe(true);
    
    const deepseekModels = PROVIDERS.deepseek.models.filter(m => m.id === 'deepseek-chat');
    expect(deepseekModels[0]?.supportVision).toBe(false);
  });

  it("should have tool support info for models", () => {
    const gpt4oModels = PROVIDERS.openai.models.filter(m => m.id === 'gpt-4o');
    expect(gpt4oModels[0]?.supportTools).toBe(true);
  });
});
