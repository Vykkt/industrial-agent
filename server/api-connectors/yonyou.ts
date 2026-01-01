/**
 * 用友API连接器
 * 支持用友U8/NC/YonSuite等产品的API调用
 */

import { BaseAPIConnector, APIConnectorConfig, APIEndpoint, APICallResult } from './base';

// 用友特定配置
export interface YonyouConfig extends APIConnectorConfig {
  productType: 'U8' | 'NC' | 'YonSuite' | 'U8Cloud';
  corpId?: string; // 企业ID
  appKey?: string; // 应用Key
  appSecret?: string; // 应用Secret
}

// 用友Token响应
interface YonyouTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

/**
 * 用友API连接器
 */
export class YonyouConnector extends BaseAPIConnector {
  private productType: string;
  private corpId: string;
  private appKey: string;
  private appSecret: string;

  constructor(config: YonyouConfig) {
    super({
      ...config,
      authType: 'oauth2',
    });
    this.productType = config.productType;
    this.corpId = config.corpId || '';
    this.appKey = config.appKey || '';
    this.appSecret = config.appSecret || '';
  }

  /**
   * 刷新Token
   */
  protected async refreshToken(): Promise<void> {
    let tokenUrl = '';
    let tokenData: Record<string, string> = {};

    switch (this.productType) {
      case 'YonSuite':
        tokenUrl = '/auth/oauth/token';
        tokenData = {
          grant_type: 'client_credentials',
          client_id: this.appKey,
          client_secret: this.appSecret,
        };
        break;

      case 'U8Cloud':
        tokenUrl = '/api/token';
        tokenData = {
          grant_type: 'password',
          username: this.config.credentials.username || '',
          password: this.config.credentials.password || '',
          client_id: this.appKey,
          client_secret: this.appSecret,
        };
        break;

      case 'NC':
        tokenUrl = '/nccloud/api/token';
        tokenData = {
          biz_center: this.corpId,
          usercode: this.config.credentials.username || '',
          password: this.config.credentials.password || '',
        };
        break;

      case 'U8':
      default:
        // U8使用Session认证
        tokenUrl = '/api/login';
        tokenData = {
          username: this.config.credentials.username || '',
          password: this.config.credentials.password || '',
          account: this.corpId,
        };
        break;
    }

    try {
      const response = await this.client.post<YonyouTokenResponse>(tokenUrl, tokenData);
      this.token = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 60) * 1000);
    } catch (error) {
      throw new Error(`用友登录失败: ${error}`);
    }
  }

  /**
   * 通用查询接口
   */
  async query(
    apiPath: string,
    params?: Record<string, unknown>
  ): Promise<APICallResult> {
    return this.call(apiPath, 'GET', undefined, params);
  }

  /**
   * 通用保存接口
   */
  async save(
    apiPath: string,
    data: Record<string, unknown>
  ): Promise<APICallResult> {
    return this.call(apiPath, 'POST', data);
  }

  /**
   * 通用更新接口
   */
  async update(
    apiPath: string,
    data: Record<string, unknown>
  ): Promise<APICallResult> {
    return this.call(apiPath, 'PUT', data);
  }

  /**
   * 通用删除接口
   */
  async remove(
    apiPath: string,
    params?: Record<string, unknown>
  ): Promise<APICallResult> {
    return this.call(apiPath, 'DELETE', undefined, params);
  }

  // ============ YonSuite 专用接口 ============

  /**
   * 查询组织信息
   */
  async getOrganizations(): Promise<APICallResult> {
    return this.call('/yonbip/digitalModel/org/list', 'GET');
  }

  /**
   * 查询员工信息
   */
  async getEmployees(params?: {
    orgId?: string;
    pageIndex?: number;
    pageSize?: number;
  }): Promise<APICallResult> {
    return this.call('/yonbip/hr/staff/list', 'GET', undefined, params);
  }

  /**
   * 查询物料信息
   */
  async getMaterials(params?: {
    code?: string;
    name?: string;
    pageIndex?: number;
    pageSize?: number;
  }): Promise<APICallResult> {
    return this.call('/yonbip/scm/material/list', 'GET', undefined, params);
  }

  /**
   * 查询采购订单
   */
  async getPurchaseOrders(params?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    pageIndex?: number;
    pageSize?: number;
  }): Promise<APICallResult> {
    return this.call('/yonbip/scm/purchaseorder/list', 'GET', undefined, params);
  }

  /**
   * 查询销售订单
   */
  async getSalesOrders(params?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    pageIndex?: number;
    pageSize?: number;
  }): Promise<APICallResult> {
    return this.call('/yonbip/scm/saleorder/list', 'GET', undefined, params);
  }

  /**
   * 查询库存信息
   */
  async getInventory(params?: {
    warehouseId?: string;
    materialCode?: string;
    pageIndex?: number;
    pageSize?: number;
  }): Promise<APICallResult> {
    return this.call('/yonbip/scm/inventory/list', 'GET', undefined, params);
  }

  /**
   * 查询凭证
   */
  async getVouchers(params?: {
    startDate?: string;
    endDate?: string;
    voucherType?: string;
    pageIndex?: number;
    pageSize?: number;
  }): Promise<APICallResult> {
    return this.call('/yonbip/fi/voucher/list', 'GET', undefined, params);
  }

  // ============ U8 专用接口 ============

  /**
   * U8 - 查询客户
   */
  async u8GetCustomers(params?: {
    cCusCode?: string;
    cCusName?: string;
  }): Promise<APICallResult> {
    return this.call('/api/customer/list', 'GET', undefined, params);
  }

  /**
   * U8 - 查询供应商
   */
  async u8GetSuppliers(params?: {
    cVenCode?: string;
    cVenName?: string;
  }): Promise<APICallResult> {
    return this.call('/api/vendor/list', 'GET', undefined, params);
  }

  /**
   * U8 - 查询存货
   */
  async u8GetInventoryItems(params?: {
    cInvCode?: string;
    cInvName?: string;
  }): Promise<APICallResult> {
    return this.call('/api/inventory/list', 'GET', undefined, params);
  }

  /**
   * U8 - 查询销售订单
   */
  async u8GetSalesOrders(params?: {
    dStartDate?: string;
    dEndDate?: string;
  }): Promise<APICallResult> {
    return this.call('/api/saleorder/list', 'GET', undefined, params);
  }

  /**
   * 获取可用端点列表
   */
  getEndpoints(): APIEndpoint[] {
    const commonEndpoints: APIEndpoint[] = [
      {
        name: 'login',
        description: '用户登录认证',
        method: 'POST',
        path: '/auth/oauth/token',
        parameters: [
          { name: 'grant_type', type: 'body', required: true, description: '授权类型' },
          { name: 'client_id', type: 'body', required: true, description: '应用ID' },
          { name: 'client_secret', type: 'body', required: true, description: '应用密钥' },
        ],
      },
    ];

    const yonSuiteEndpoints: APIEndpoint[] = [
      {
        name: 'getOrganizations',
        description: '查询组织信息',
        method: 'GET',
        path: '/yonbip/digitalModel/org/list',
        parameters: [],
      },
      {
        name: 'getEmployees',
        description: '查询员工信息',
        method: 'GET',
        path: '/yonbip/hr/staff/list',
        parameters: [
          { name: 'orgId', type: 'query', required: false, description: '组织ID' },
          { name: 'pageIndex', type: 'query', required: false, description: '页码' },
          { name: 'pageSize', type: 'query', required: false, description: '每页数量' },
        ],
      },
      {
        name: 'getMaterials',
        description: '查询物料信息',
        method: 'GET',
        path: '/yonbip/scm/material/list',
        parameters: [
          { name: 'code', type: 'query', required: false, description: '物料编码' },
          { name: 'name', type: 'query', required: false, description: '物料名称' },
        ],
      },
      {
        name: 'getPurchaseOrders',
        description: '查询采购订单',
        method: 'GET',
        path: '/yonbip/scm/purchaseorder/list',
        parameters: [
          { name: 'startDate', type: 'query', required: false, description: '开始日期' },
          { name: 'endDate', type: 'query', required: false, description: '结束日期' },
          { name: 'status', type: 'query', required: false, description: '状态' },
        ],
      },
      {
        name: 'getSalesOrders',
        description: '查询销售订单',
        method: 'GET',
        path: '/yonbip/scm/saleorder/list',
        parameters: [
          { name: 'startDate', type: 'query', required: false, description: '开始日期' },
          { name: 'endDate', type: 'query', required: false, description: '结束日期' },
        ],
      },
      {
        name: 'getInventory',
        description: '查询库存信息',
        method: 'GET',
        path: '/yonbip/scm/inventory/list',
        parameters: [
          { name: 'warehouseId', type: 'query', required: false, description: '仓库ID' },
          { name: 'materialCode', type: 'query', required: false, description: '物料编码' },
        ],
      },
      {
        name: 'getVouchers',
        description: '查询凭证',
        method: 'GET',
        path: '/yonbip/fi/voucher/list',
        parameters: [
          { name: 'startDate', type: 'query', required: false, description: '开始日期' },
          { name: 'endDate', type: 'query', required: false, description: '结束日期' },
          { name: 'voucherType', type: 'query', required: false, description: '凭证类型' },
        ],
      },
    ];

    return this.productType === 'YonSuite' 
      ? [...commonEndpoints, ...yonSuiteEndpoints]
      : commonEndpoints;
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.refreshToken();
      return !!this.token;
    } catch {
      return false;
    }
  }
}
