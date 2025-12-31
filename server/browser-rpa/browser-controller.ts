/**
 * 浏览器控制器
 * 基于Playwright实现浏览器自动化操作
 * 参考browser-use和OpenManus的实现
 */

// 浏览器状态
export interface BrowserState {
  url: string;
  title: string;
  tabs: TabInfo[];
  interactiveElements: InteractiveElement[];
  screenshot?: string; // base64
  html?: string;
}

// 标签页信息
export interface TabInfo {
  id: string;
  url: string;
  title: string;
  active: boolean;
}

// 可交互元素
export interface InteractiveElement {
  index: number;
  tag: string;
  type?: string;
  text: string;
  placeholder?: string;
  value?: string;
  href?: string;
  ariaLabel?: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isVisible: boolean;
  isEnabled: boolean;
}

// 浏览器动作类型
export type BrowserActionType = 
  | 'goto'
  | 'click'
  | 'type'
  | 'scroll'
  | 'select'
  | 'hover'
  | 'wait'
  | 'screenshot'
  | 'evaluate'
  | 'extract'
  | 'back'
  | 'forward'
  | 'refresh'
  | 'newTab'
  | 'closeTab'
  | 'switchTab';

// 浏览器动作
export interface BrowserAction {
  type: BrowserActionType;
  params: Record<string, unknown>;
}

// 动作结果
export interface ActionResult {
  success: boolean;
  action: BrowserAction;
  result?: unknown;
  error?: string;
  screenshot?: string;
  duration: number;
}

// 元素提取脚本
const EXTRACT_ELEMENTS_SCRIPT = `
() => {
  const interactiveSelectors = [
    'a[href]',
    'button',
    'input',
    'select',
    'textarea',
    '[role="button"]',
    '[role="link"]',
    '[role="menuitem"]',
    '[role="tab"]',
    '[onclick]',
    '[tabindex]'
  ];
  
  const elements = [];
  let index = 0;
  
  document.querySelectorAll(interactiveSelectors.join(',')).forEach(el => {
    const rect = el.getBoundingClientRect();
    const isVisible = rect.width > 0 && rect.height > 0 && 
      rect.top < window.innerHeight && rect.bottom > 0 &&
      rect.left < window.innerWidth && rect.right > 0;
    
    if (!isVisible) return;
    
    const text = el.textContent?.trim().slice(0, 100) || '';
    const tag = el.tagName.toLowerCase();
    
    elements.push({
      index: index++,
      tag,
      type: el.getAttribute('type') || undefined,
      text,
      placeholder: el.getAttribute('placeholder') || undefined,
      value: el.value || undefined,
      href: el.getAttribute('href') || undefined,
      ariaLabel: el.getAttribute('aria-label') || undefined,
      boundingBox: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      },
      isVisible: true,
      isEnabled: !el.disabled
    });
  });
  
  return elements;
}
`;

/**
 * 浏览器控制器类
 * 注意：实际使用需要安装playwright依赖
 * pnpm add playwright
 */
export class BrowserController {
  private browser: unknown = null;
  private context: unknown = null;
  private page: unknown = null;
  private isInitialized = false;

  /**
   * 初始化浏览器
   */
  async initialize(options?: {
    headless?: boolean;
    viewport?: { width: number; height: number };
    userAgent?: string;
  }): Promise<void> {
    // 动态导入playwright（如果已安装）
    try {
      // @ts-ignore - playwright可能未安装
      const playwright = await import(/* webpackIgnore: true */ 'playwright');
      
      this.browser = await playwright.chromium.launch({
        headless: options?.headless ?? true,
      });

      this.context = await (this.browser as { newContext: (opts: unknown) => Promise<unknown> }).newContext({
        viewport: options?.viewport || { width: 1920, height: 1080 },
        userAgent: options?.userAgent,
      });

      this.page = await (this.context as { newPage: () => Promise<unknown> }).newPage();
      this.isInitialized = true;
    } catch (error) {
      console.warn('Playwright未安装，浏览器RPA功能将使用模拟模式');
      this.isInitialized = false;
    }
  }

  /**
   * 关闭浏览器
   */
  async close(): Promise<void> {
    if (this.browser) {
      await (this.browser as { close: () => Promise<void> }).close();
      this.browser = null;
      this.context = null;
      this.page = null;
      this.isInitialized = false;
    }
  }

  /**
   * 获取当前浏览器状态
   */
  async getState(): Promise<BrowserState> {
    if (!this.isInitialized || !this.page) {
      return this.getMockState();
    }

    const page = this.page as {
      url: () => string;
      title: () => Promise<string>;
      evaluate: (script: string) => Promise<InteractiveElement[]>;
      screenshot: (opts: { encoding: string }) => Promise<string>;
    };

    const url = page.url();
    const title = await page.title();
    const interactiveElements = await page.evaluate(EXTRACT_ELEMENTS_SCRIPT);
    const screenshot = await page.screenshot({ encoding: 'base64' });

    return {
      url,
      title,
      tabs: [{ id: '1', url, title, active: true }],
      interactiveElements,
      screenshot,
    };
  }

  /**
   * 执行浏览器动作
   */
  async executeAction(action: BrowserAction): Promise<ActionResult> {
    const startTime = Date.now();

    if (!this.isInitialized || !this.page) {
      return this.executeMockAction(action, startTime);
    }

    try {
      const result = await this.doExecuteAction(action);
      const screenshot = await (this.page as { screenshot: (opts: { encoding: string }) => Promise<string> })
        .screenshot({ encoding: 'base64' });

      return {
        success: true,
        action,
        result,
        screenshot,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        action,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 执行具体动作
   */
  private async doExecuteAction(action: BrowserAction): Promise<unknown> {
    const page = this.page as {
      goto: (url: string, opts?: unknown) => Promise<unknown>;
      click: (selector: string) => Promise<void>;
      fill: (selector: string, text: string) => Promise<void>;
      evaluate: (script: string | (() => void)) => Promise<unknown>;
      waitForTimeout: (ms: number) => Promise<void>;
      goBack: () => Promise<unknown>;
      goForward: () => Promise<unknown>;
      reload: () => Promise<unknown>;
      locator: (selector: string) => {
        click: () => Promise<void>;
        fill: (text: string) => Promise<void>;
        selectOption: (value: string) => Promise<string[]>;
        hover: () => Promise<void>;
        scrollIntoViewIfNeeded: () => Promise<void>;
      };
    };

    switch (action.type) {
      case 'goto':
        return page.goto(action.params.url as string, { waitUntil: 'networkidle' });

      case 'click':
        if (action.params.index !== undefined) {
          const selector = `[data-browser-index="${action.params.index}"]`;
          return page.locator(selector).click();
        } else if (action.params.selector) {
          return page.click(action.params.selector as string);
        }
        break;

      case 'type':
        if (action.params.index !== undefined) {
          const selector = `[data-browser-index="${action.params.index}"]`;
          return page.locator(selector).fill(action.params.text as string);
        } else if (action.params.selector) {
          return page.fill(action.params.selector as string, action.params.text as string);
        }
        break;

      case 'scroll':
        const direction = action.params.direction as string;
        const amount = (action.params.amount as number) || 500;
        return page.evaluate(`window.scrollBy(0, ${direction === 'down' ? amount : -amount})`);

      case 'select':
        if (action.params.index !== undefined) {
          const selector = `[data-browser-index="${action.params.index}"]`;
          return page.locator(selector).selectOption(action.params.value as string);
        }
        break;

      case 'hover':
        if (action.params.index !== undefined) {
          const selector = `[data-browser-index="${action.params.index}"]`;
          return page.locator(selector).hover();
        }
        break;

      case 'wait':
        return page.waitForTimeout((action.params.ms as number) || 1000);

      case 'evaluate':
        return page.evaluate(action.params.script as string);

      case 'extract':
        return page.evaluate(action.params.script as string);

      case 'back':
        return page.goBack();

      case 'forward':
        return page.goForward();

      case 'refresh':
        return page.reload();

      default:
        throw new Error(`不支持的动作类型: ${action.type}`);
    }
  }

  /**
   * 获取模拟状态（未安装playwright时使用）
   */
  private getMockState(): BrowserState {
    return {
      url: 'about:blank',
      title: '模拟浏览器',
      tabs: [{ id: '1', url: 'about:blank', title: '模拟浏览器', active: true }],
      interactiveElements: [],
    };
  }

  /**
   * 执行模拟动作（未安装playwright时使用）
   */
  private executeMockAction(action: BrowserAction, startTime: number): ActionResult {
    return {
      success: true,
      action,
      result: { mock: true, message: '模拟执行成功' },
      duration: Date.now() - startTime,
    };
  }

  /**
   * 格式化状态为LLM可理解的文本
   */
  formatStateForLLM(state: BrowserState): string {
    let output = `当前URL: ${state.url}\n`;
    output += `页面标题: ${state.title}\n\n`;
    output += `可交互元素:\n`;

    for (const el of state.interactiveElements) {
      let elStr = `[${el.index}]<${el.tag}`;
      if (el.type) elStr += ` type="${el.type}"`;
      if (el.placeholder) elStr += ` placeholder="${el.placeholder}"`;
      elStr += `>${el.text}</${el.tag}>`;
      output += elStr + '\n';
    }

    return output;
  }
}

// 导出单例
export const browserController = new BrowserController();
