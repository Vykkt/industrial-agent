/**
 * 工业软件API连接器基类
 * 提供统一的API调用接口，支持金蝶、用友、SAP等工业软件
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

// API连接器配置接口
export interface APIConnectorConfig {
  name: string;
  baseUrl: string;
  authType: 'basic' | 'bearer' | 'apikey' | 'oauth2' | 'custom';
  credentials: {
    username?: string;
    password?: string;
    apiKey?: string;
    clientId?: string;
    clientSecret?: string;
    token?: string;
  };
  timeout?: number;
  headers?: Record<string, string>;
}

// API调用结果接口
export interface APICallResult {
  success: boolean;
  data?: unknown;
  error?: string;
  statusCode?: number;
  responseTime: number;
  rawResponse?: unknown;
}

// API端点定义
export interface APIEndpoint {
  name: string;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  parameters?: {
    name: string;
    type: 'query' | 'body' | 'path' | 'header';
    required: boolean;
    description: string;
    schema?: unknown;
  }[];
  responseSchema?: unknown;
}

/**
 * API连接器基类
 */
export abstract class BaseAPIConnector {
  protected config: APIConnectorConfig;
  protected client: AxiosInstance;
  protected token: string | null = null;
  protected tokenExpiry: Date | null = null;

  constructor(config: APIConnectorConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout || 30000,
      headers: config.headers || {},
    });

    // 添加请求拦截器
    this.client.interceptors.request.use(
      async (config) => {
        const authHeader = await this.getAuthHeader();
        if (authHeader) {
          Object.assign(config.headers || {}, authHeader);
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
  }

  /**
   * 获取认证头
   */
  protected async getAuthHeader(): Promise<Record<string, string> | null> {
    switch (this.config.authType) {
      case 'basic':
        const basicAuth = Buffer.from(
          `${this.config.credentials.username}:${this.config.credentials.password}`
        ).toString('base64');
        return { Authorization: `Basic ${basicAuth}` };

      case 'bearer':
        if (!this.token || this.isTokenExpired()) {
          await this.refreshToken();
        }
        return this.token ? { Authorization: `Bearer ${this.token}` } : null;

      case 'apikey':
        return this.config.credentials.apiKey
          ? { 'X-API-Key': this.config.credentials.apiKey }
          : null;

      case 'oauth2':
        if (!this.token || this.isTokenExpired()) {
          await this.refreshToken();
        }
        return this.token ? { Authorization: `Bearer ${this.token}` } : null;

      case 'custom':
        return this.getCustomAuthHeader();

      default:
        return null;
    }
  }

  /**
   * 检查Token是否过期
   */
  protected isTokenExpired(): boolean {
    if (!this.tokenExpiry) return true;
    return new Date() >= this.tokenExpiry;
  }

  /**
   * 刷新Token（子类实现）
   */
  protected abstract refreshToken(): Promise<void>;

  /**
   * 获取自定义认证头（子类可覆盖）
   */
  protected getCustomAuthHeader(): Record<string, string> | null {
    return null;
  }

  /**
   * 执行API调用
   */
  async call(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
    data?: unknown,
    params?: Record<string, unknown>,
    headers?: Record<string, string>
  ): Promise<APICallResult> {
    const startTime = Date.now();

    try {
      const config: AxiosRequestConfig = {
        method,
        url: endpoint,
        data,
        params,
        headers,
      };

      const response = await this.client.request(config);

      return {
        success: true,
        data: response.data,
        statusCode: response.status,
        responseTime: Date.now() - startTime,
        rawResponse: response,
      };
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number; data?: unknown }; message?: string };
      return {
        success: false,
        error: axiosError.message || 'Unknown error',
        statusCode: axiosError.response?.status,
        responseTime: Date.now() - startTime,
        rawResponse: axiosError.response?.data,
      };
    }
  }

  /**
   * 获取可用端点列表（子类实现）
   */
  abstract getEndpoints(): APIEndpoint[];

  /**
   * 测试连接
   */
  abstract testConnection(): Promise<boolean>;

  /**
   * 获取连接器名称
   */
  getName(): string {
    return this.config.name;
  }
}

/**
 * API连接器注册表
 */
export class APIConnectorRegistry {
  private static connectors: Map<string, BaseAPIConnector> = new Map();

  static register(name: string, connector: BaseAPIConnector): void {
    this.connectors.set(name, connector);
  }

  static get(name: string): BaseAPIConnector | undefined {
    return this.connectors.get(name);
  }

  static getAll(): Map<string, BaseAPIConnector> {
    return this.connectors;
  }

  static remove(name: string): boolean {
    return this.connectors.delete(name);
  }

  static list(): string[] {
    return Array.from(this.connectors.keys());
  }
}
