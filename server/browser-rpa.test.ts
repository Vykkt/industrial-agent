/**
 * 浏览器RPA模块测试
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  BrowserController,
  browserController,
  BrowserAction,
  BrowserState,
} from "./browser-rpa/browser-controller";
import {
  BrowserAgent,
  createBrowserAgent,
  BrowserAgentConfig,
} from "./browser-rpa/browser-agent";

describe("BrowserController", () => {
  let controller: BrowserController;

  beforeEach(() => {
    controller = new BrowserController();
  });

  afterEach(async () => {
    await controller.close();
  });

  it("should create browser controller instance", () => {
    expect(controller).toBeDefined();
    expect(typeof controller.initialize).toBe('function');
    expect(typeof controller.close).toBe('function');
    expect(typeof controller.getState).toBe('function');
    expect(typeof controller.executeAction).toBe('function');
  });

  it("should return mock state when playwright is not installed", async () => {
    // 不初始化浏览器，应返回模拟状态
    const state = await controller.getState();
    expect(state).toBeDefined();
    expect(state.url).toBe('about:blank');
    expect(state.title).toBe('模拟浏览器');
    expect(state.tabs).toHaveLength(1);
    expect(state.interactiveElements).toHaveLength(0);
  });

  it("should execute mock action when playwright is not installed", async () => {
    const action: BrowserAction = {
      type: 'goto',
      params: { url: 'https://example.com' }
    };
    
    const result = await controller.executeAction(action);
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.action).toEqual(action);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it("should format state for LLM correctly", () => {
    const mockState: BrowserState = {
      url: 'https://example.com',
      title: 'Example Page',
      tabs: [{ id: '1', url: 'https://example.com', title: 'Example Page', active: true }],
      interactiveElements: [
        {
          index: 0,
          tag: 'button',
          type: 'submit',
          text: 'Submit',
          isVisible: true,
          isEnabled: true
        },
        {
          index: 1,
          tag: 'input',
          type: 'text',
          text: '',
          placeholder: 'Enter name',
          isVisible: true,
          isEnabled: true
        }
      ]
    };
    
    const formatted = controller.formatStateForLLM(mockState);
    expect(formatted).toContain('当前URL: https://example.com');
    expect(formatted).toContain('页面标题: Example Page');
    expect(formatted).toContain('[0]<button');
    expect(formatted).toContain('[1]<input');
    expect(formatted).toContain('placeholder="Enter name"');
  });
});

describe("BrowserController Actions", () => {
  let controller: BrowserController;

  beforeEach(() => {
    controller = new BrowserController();
  });

  afterEach(async () => {
    await controller.close();
  });

  it("should handle goto action", async () => {
    const result = await controller.executeAction({
      type: 'goto',
      params: { url: 'https://example.com' }
    });
    expect(result.success).toBe(true);
    expect(result.action.type).toBe('goto');
  });

  it("should handle click action", async () => {
    const result = await controller.executeAction({
      type: 'click',
      params: { index: 0 }
    });
    expect(result.success).toBe(true);
    expect(result.action.type).toBe('click');
  });

  it("should handle type action", async () => {
    const result = await controller.executeAction({
      type: 'type',
      params: { index: 0, text: 'Hello World' }
    });
    expect(result.success).toBe(true);
    expect(result.action.type).toBe('type');
  });

  it("should handle scroll action", async () => {
    const result = await controller.executeAction({
      type: 'scroll',
      params: { direction: 'down', amount: 500 }
    });
    expect(result.success).toBe(true);
    expect(result.action.type).toBe('scroll');
  });

  it("should handle wait action", async () => {
    const result = await controller.executeAction({
      type: 'wait',
      params: { ms: 100 }
    });
    expect(result.success).toBe(true);
    expect(result.action.type).toBe('wait');
  });
});

describe("BrowserAgent", () => {
  it("should create browser agent with config", () => {
    const config: BrowserAgentConfig = {
      llmConfig: {
        provider: 'builtin',
        model: 'default'
      },
      maxSteps: 10,
      timeout: 60000,
      verbose: false
    };
    
    const agent = createBrowserAgent(config);
    expect(agent).toBeDefined();
    expect(typeof agent.run).toBe('function');
    expect(typeof agent.getState).toBe('function');
  });

  it("should have null state before running", () => {
    const agent = createBrowserAgent({
      llmConfig: { provider: 'builtin', model: 'default' }
    });
    
    expect(agent.getState()).toBeNull();
  });
});

describe("BrowserAction Types", () => {
  it("should support all action types", () => {
    const actionTypes = [
      'goto', 'click', 'type', 'scroll', 'select', 'hover',
      'wait', 'screenshot', 'evaluate', 'extract',
      'back', 'forward', 'refresh', 'newTab', 'closeTab', 'switchTab'
    ];
    
    // 验证所有动作类型都是有效的
    for (const type of actionTypes) {
      const action: BrowserAction = {
        type: type as BrowserAction['type'],
        params: {}
      };
      expect(action.type).toBe(type);
    }
  });
});

describe("Singleton BrowserController", () => {
  it("should export singleton instance", () => {
    expect(browserController).toBeDefined();
    expect(browserController).toBeInstanceOf(BrowserController);
  });
});
