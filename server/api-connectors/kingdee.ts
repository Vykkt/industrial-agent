/**
 * 金蝶云星空API连接器
 * 支持金蝶K3 Cloud WebAPI调用
 */

import { BaseAPIConnector, APIConnectorConfig, APIEndpoint, APICallResult } from './base';

// 金蝶特定配置
export interface KingdeeConfig extends APIConnectorConfig {
  acctId: string; // 账套ID
  lcId?: number; // 语言ID，默认2052（简体中文）
  orgId?: number; // 组织ID
}

// 金蝶登录响应
interface KingdeeLoginResponse {
  LoginResultType: number;
  Message: string;
  Context: {
    SessionId: string;
    UserId: number;
    UserName: string;
  };
}

// 金蝶查询参数
export interface KingdeeQueryParams {
  FormId: string; // 业务对象标识
  FieldKeys: string; // 查询字段
  FilterString?: string; // 过滤条件
  OrderString?: string; // 排序
  TopRowCount?: number; // 返回行数
  StartRow?: number; // 起始行
  Limit?: number; // 分页大小
}

// 金蝶保存参数
export interface KingdeeSaveParams {
  FormId: string;
  Model: Record<string, unknown>;
  IsAutoSubmitAndAudit?: boolean;
  IsVerifyBaseDataField?: boolean;
}

/**
 * 金蝶云星空API连接器
 */
export class KingdeeConnector extends BaseAPIConnector {
  private acctId: string;
  private lcId: number;
  private orgId: number;
  private sessionId: string | null = null;

  constructor(config: KingdeeConfig) {
    super({
      ...config,
      authType: 'custom',
    });
    this.acctId = config.acctId;
    this.lcId = config.lcId || 2052;
    this.orgId = config.orgId || 0;
  }

  /**
   * 刷新Token（登录获取SessionId）
   */
  protected async refreshToken(): Promise<void> {
    const loginUrl = '/Kingdee.BOS.WebApi.ServicesStub.AuthService.ValidateUser.common.kdsvc';
    
    const loginData = {
      acctID: this.acctId,
      username: this.config.credentials.username,
      password: this.config.credentials.password,
      lcid: this.lcId,
    };

    try {
      const response = await this.client.post<KingdeeLoginResponse>(loginUrl, loginData);
      
      if (response.data.LoginResultType === 1) {
        this.sessionId = response.data.Context.SessionId;
        this.token = this.sessionId;
        // 金蝶Session默认30分钟过期
        this.tokenExpiry = new Date(Date.now() + 25 * 60 * 1000);
      } else {
        throw new Error(`金蝶登录失败: ${response.data.Message}`);
      }
    } catch (error) {
      throw new Error(`金蝶登录异常: ${error}`);
    }
  }

  /**
   * 获取自定义认证头
   */
  protected getCustomAuthHeader(): Record<string, string> | null {
    if (this.sessionId) {
      return {
        'Cookie': `ASP.NET_SessionId=${this.sessionId}`,
        'Content-Type': 'application/json',
      };
    }
    return { 'Content-Type': 'application/json' };
  }

  /**
   * 单据查询
   */
  async executeBillQuery(params: KingdeeQueryParams): Promise<APICallResult> {
    const url = '/Kingdee.BOS.WebApi.ServicesStub.DynamicFormService.ExecuteBillQuery.common.kdsvc';
    
    const data = {
      FormId: params.FormId,
      FieldKeys: params.FieldKeys,
      FilterString: params.FilterString || '',
      OrderString: params.OrderString || '',
      TopRowCount: params.TopRowCount || 0,
      StartRow: params.StartRow || 0,
      Limit: params.Limit || 2000,
    };

    return this.call(url, 'POST', data);
  }

  /**
   * 保存单据
   */
  async save(params: KingdeeSaveParams): Promise<APICallResult> {
    const url = '/Kingdee.BOS.WebApi.ServicesStub.DynamicFormService.Save.common.kdsvc';
    
    const data = {
      formid: params.FormId,
      data: {
        Model: params.Model,
      },
      IsAutoSubmitAndAudit: params.IsAutoSubmitAndAudit || false,
      IsVerifyBaseDataField: params.IsVerifyBaseDataField || true,
    };

    return this.call(url, 'POST', data);
  }

  /**
   * 提交单据
   */
  async submit(formId: string, numbers: string[]): Promise<APICallResult> {
    const url = '/Kingdee.BOS.WebApi.ServicesStub.DynamicFormService.Submit.common.kdsvc';
    
    const data = {
      formid: formId,
      data: {
        Numbers: numbers,
      },
    };

    return this.call(url, 'POST', data);
  }

  /**
   * 审核单据
   */
  async audit(formId: string, numbers: string[]): Promise<APICallResult> {
    const url = '/Kingdee.BOS.WebApi.ServicesStub.DynamicFormService.Audit.common.kdsvc';
    
    const data = {
      formid: formId,
      data: {
        Numbers: numbers,
      },
    };

    return this.call(url, 'POST', data);
  }

  /**
   * 反审核单据
   */
  async unAudit(formId: string, numbers: string[]): Promise<APICallResult> {
    const url = '/Kingdee.BOS.WebApi.ServicesStub.DynamicFormService.UnAudit.common.kdsvc';
    
    const data = {
      formid: formId,
      data: {
        Numbers: numbers,
      },
    };

    return this.call(url, 'POST', data);
  }

  /**
   * 删除单据
   */
  async delete(formId: string, numbers: string[]): Promise<APICallResult> {
    const url = '/Kingdee.BOS.WebApi.ServicesStub.DynamicFormService.Delete.common.kdsvc';
    
    const data = {
      formid: formId,
      data: {
        Numbers: numbers,
      },
    };

    return this.call(url, 'POST', data);
  }

  /**
   * 查看单据
   */
  async view(formId: string, number: string): Promise<APICallResult> {
    const url = '/Kingdee.BOS.WebApi.ServicesStub.DynamicFormService.View.common.kdsvc';
    
    const data = {
      FormId: formId,
      data: {
        Number: number,
      },
    };

    return this.call(url, 'POST', data);
  }

  /**
   * 获取可用端点列表
   */
  getEndpoints(): APIEndpoint[] {
    return [
      {
        name: 'login',
        description: '用户登录认证',
        method: 'POST',
        path: '/Kingdee.BOS.WebApi.ServicesStub.AuthService.ValidateUser.common.kdsvc',
        parameters: [
          { name: 'acctID', type: 'body', required: true, description: '账套ID' },
          { name: 'username', type: 'body', required: true, description: '用户名' },
          { name: 'password', type: 'body', required: true, description: '密码' },
          { name: 'lcid', type: 'body', required: false, description: '语言ID' },
        ],
      },
      {
        name: 'executeBillQuery',
        description: '单据查询',
        method: 'POST',
        path: '/Kingdee.BOS.WebApi.ServicesStub.DynamicFormService.ExecuteBillQuery.common.kdsvc',
        parameters: [
          { name: 'FormId', type: 'body', required: true, description: '业务对象标识' },
          { name: 'FieldKeys', type: 'body', required: true, description: '查询字段，逗号分隔' },
          { name: 'FilterString', type: 'body', required: false, description: '过滤条件' },
          { name: 'OrderString', type: 'body', required: false, description: '排序字段' },
          { name: 'TopRowCount', type: 'body', required: false, description: '返回行数' },
        ],
      },
      {
        name: 'save',
        description: '保存单据',
        method: 'POST',
        path: '/Kingdee.BOS.WebApi.ServicesStub.DynamicFormService.Save.common.kdsvc',
        parameters: [
          { name: 'formid', type: 'body', required: true, description: '业务对象标识' },
          { name: 'data', type: 'body', required: true, description: '单据数据' },
        ],
      },
      {
        name: 'submit',
        description: '提交单据',
        method: 'POST',
        path: '/Kingdee.BOS.WebApi.ServicesStub.DynamicFormService.Submit.common.kdsvc',
        parameters: [
          { name: 'formid', type: 'body', required: true, description: '业务对象标识' },
          { name: 'Numbers', type: 'body', required: true, description: '单据编号数组' },
        ],
      },
      {
        name: 'audit',
        description: '审核单据',
        method: 'POST',
        path: '/Kingdee.BOS.WebApi.ServicesStub.DynamicFormService.Audit.common.kdsvc',
        parameters: [
          { name: 'formid', type: 'body', required: true, description: '业务对象标识' },
          { name: 'Numbers', type: 'body', required: true, description: '单据编号数组' },
        ],
      },
      {
        name: 'view',
        description: '查看单据详情',
        method: 'POST',
        path: '/Kingdee.BOS.WebApi.ServicesStub.DynamicFormService.View.common.kdsvc',
        parameters: [
          { name: 'FormId', type: 'body', required: true, description: '业务对象标识' },
          { name: 'Number', type: 'body', required: true, description: '单据编号' },
        ],
      },
    ];
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.refreshToken();
      return !!this.sessionId;
    } catch {
      return false;
    }
  }

  /**
   * 常用业务对象FormId
   */
  static readonly FormIds = {
    // 财务模块
    GL_VOUCHER: 'GL_VOUCHER', // 凭证
    AP_PAYABLE: 'AP_PAYABLE', // 应付单
    AR_RECEIVABLE: 'AR_RECEIVABLE', // 应收单
    CN_PAYBILL: 'CN_PAYBILL', // 付款单
    CN_RECEIVEBILL: 'CN_RECEIVEBILL', // 收款单
    
    // 供应链模块
    PUR_Requisition: 'PUR_Requisition', // 采购申请单
    PUR_PurchaseOrder: 'PUR_PurchaseOrder', // 采购订单
    PUR_ReceiveBill: 'PUR_ReceiveBill', // 采购入库单
    SAL_SaleOrder: 'SAL_SaleOrder', // 销售订单
    SAL_OUTSTOCK: 'SAL_OUTSTOCK', // 销售出库单
    STK_InStock: 'STK_InStock', // 其他入库单
    STK_OutStock: 'STK_OutStock', // 其他出库单
    STK_TransferDirect: 'STK_TransferDirect', // 直接调拨单
    STK_Inventory: 'STK_Inventory', // 库存盘点
    
    // 生产模块
    PRD_MO: 'PRD_MO', // 生产订单
    PRD_MORPT: 'PRD_MORPT', // 生产汇报单
    PRD_PickMtrl: 'PRD_PickMtrl', // 生产领料单
    PRD_ReturnMtrl: 'PRD_ReturnMtrl', // 生产退料单
    PRD_INSTOCK: 'PRD_INSTOCK', // 产品入库单
    
    // 基础资料
    BD_MATERIAL: 'BD_MATERIAL', // 物料
    BD_CUSTOMER: 'BD_CUSTOMER', // 客户
    BD_SUPPLIER: 'BD_SUPPLIER', // 供应商
    BD_DEPARTMENT: 'BD_DEPARTMENT', // 部门
    BD_EMPINFO: 'BD_EMPINFO', // 员工
    BD_STOCK: 'BD_STOCK', // 仓库
  };
}
