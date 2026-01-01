/**
 * Skills 模块入口
 * 负责加载和管理工业Agent的技能定义
 */

import * as fs from 'fs';
import * as path from 'path';

// 技能类型定义
export interface WorkflowStep {
  id: string;
  name: string;
  type: 'llm' | 'tool' | 'mcp_call';
  description?: string;
  prompt?: string;
  tool?: string;
  condition?: string;
  params?: Record<string, string>;
  output?: string[];
}

export interface Workflow {
  name: string;
  displayName: string;
  description: string;
  version: string;
  category: string;
  triggers: {
    categories?: string[];
    keywords?: string[];
  };
  tools: string[];
  steps: WorkflowStep[];
  response_template: string;
}

export interface Scenario {
  name: string;
  displayName: string;
  description: string;
  version: string;
  priority: string;
  detection: {
    keywords: string[];
    systems: string[];
    categories?: string[];
  };
  tools_required: {
    primary: string[];
    secondary?: string[];
    optional?: string[];
  };
  knowledge_domains: string[];
  workflow_mapping: Record<string, string>;
  response_template: string;
}

export interface SkillsConfig {
  workflows: Map<string, Workflow>;
  scenarios: Map<string, Scenario>;
  prompts: Map<string, string>;
  templates: Map<string, string>;
}

// 全局技能配置
let skillsConfig: SkillsConfig | null = null;

/**
 * 加载所有技能配置
 */
export async function loadSkills(skillsDir?: string): Promise<SkillsConfig> {
  const baseDir = skillsDir || path.join(process.cwd(), 'skills');
  
  const config: SkillsConfig = {
    workflows: new Map(),
    scenarios: new Map(),
    prompts: new Map(),
    templates: new Map()
  };

  // 加载工作流
  const workflowsDir = path.join(baseDir, 'workflows');
  if (fs.existsSync(workflowsDir)) {
    const files = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(workflowsDir, file), 'utf-8');
        const workflow = parseYaml(content) as Workflow;
        if (workflow.name) {
          config.workflows.set(workflow.name, workflow);
        }
      } catch (error) {
        console.error(`Failed to load workflow ${file}:`, error);
      }
    }
  }

  // 加载场景
  const scenariosDir = path.join(baseDir, 'scenarios');
  if (fs.existsSync(scenariosDir)) {
    const files = fs.readdirSync(scenariosDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(scenariosDir, file), 'utf-8');
        const scenario = parseYaml(content) as Scenario;
        if (scenario.name) {
          config.scenarios.set(scenario.name, scenario);
        }
      } catch (error) {
        console.error(`Failed to load scenario ${file}:`, error);
      }
    }
  }

  // 加载提示词
  const promptsDir = path.join(baseDir, 'prompts');
  if (fs.existsSync(promptsDir)) {
    const files = fs.readdirSync(promptsDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(promptsDir, file), 'utf-8');
        const name = file.replace('.md', '');
        config.prompts.set(name, content);
      } catch (error) {
        console.error(`Failed to load prompt ${file}:`, error);
      }
    }
  }

  // 加载模板
  const templatesDir = path.join(baseDir, 'templates');
  if (fs.existsSync(templatesDir)) {
    const files = fs.readdirSync(templatesDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(templatesDir, file), 'utf-8');
        const name = file.replace('.md', '');
        config.templates.set(name, content);
      } catch (error) {
        console.error(`Failed to load template ${file}:`, error);
      }
    }
  }

  skillsConfig = config;
  return config;
}

/**
 * 获取技能配置
 */
export function getSkillsConfig(): SkillsConfig | null {
  return skillsConfig;
}

/**
 * 获取指定工作流
 */
export function getWorkflow(name: string): Workflow | undefined {
  return skillsConfig?.workflows.get(name);
}

/**
 * 获取指定场景
 */
export function getScenario(name: string): Scenario | undefined {
  return skillsConfig?.scenarios.get(name);
}

/**
 * 获取指定提示词
 */
export function getPrompt(name: string): string | undefined {
  return skillsConfig?.prompts.get(name);
}

/**
 * 获取指定模板
 */
export function getTemplate(name: string): string | undefined {
  return skillsConfig?.templates.get(name);
}

/**
 * 根据问题匹配最佳工作流
 */
export function matchWorkflow(category: string, keywords: string[]): Workflow | undefined {
  if (!skillsConfig) return undefined;
  
  let bestMatch: Workflow | undefined;
  let bestScore = 0;

  for (const workflow of Array.from(skillsConfig.workflows.values())) {
    let score = 0;
    
    // 类别匹配
    if (workflow.triggers.categories?.includes(category)) {
      score += 10;
    }
    
    // 关键词匹配
    if (workflow.triggers.keywords) {
      for (const kw of keywords) {
        if (workflow.triggers.keywords.some((wkw: string) => kw.includes(wkw) || wkw.includes(kw))) {
          score += 2;
        }
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = workflow;
    }
  }

  return bestMatch;
}

/**
 * 根据问题匹配最佳场景
 */
export function matchScenario(text: string, system?: string): Scenario | undefined {
  if (!skillsConfig) return undefined;
  
  let bestMatch: Scenario | undefined;
  let bestScore = 0;

  for (const scenario of Array.from(skillsConfig.scenarios.values())) {
    let score = 0;
    
    // 系统匹配
    if (system && scenario.detection.systems.includes(system)) {
      score += 5;
    }
    
    // 关键词匹配
    for (const kw of scenario.detection.keywords) {
      if (text.includes(kw)) {
        score += 3;
      }
    }
    
    // 优先级加权
    if (scenario.priority === 'high') {
      score *= 1.2;
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = scenario;
    }
  }

  return bestMatch;
}

/**
 * 简单的YAML解析器（用于基本配置）
 * 生产环境建议使用 js-yaml 库
 */
function parseYaml(content: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = content.split('\n');
  const stack: { indent: number; obj: Record<string, any>; key?: string }[] = [{ indent: -1, obj: result }];
  
  for (const line of lines) {
    // 跳过空行和注释
    if (!line.trim() || line.trim().startsWith('#')) continue;
    
    // 计算缩进
    const indent = line.search(/\S/);
    const trimmed = line.trim();
    
    // 处理列表项
    if (trimmed.startsWith('- ')) {
      const value = trimmed.slice(2).trim();
      const parent = stack[stack.length - 1];
      const key = parent.key;
      if (key && parent.obj[key]) {
        if (!Array.isArray(parent.obj[key])) {
          parent.obj[key] = [];
        }
        if (value.includes(':')) {
          const obj: Record<string, any> = {};
          const [k, v] = value.split(':').map(s => s.trim());
          obj[k] = parseValue(v);
          parent.obj[key].push(obj);
        } else {
          parent.obj[key].push(parseValue(value));
        }
      }
      continue;
    }
    
    // 处理键值对
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0) {
      const key = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();
      
      // 弹出栈中缩进大于等于当前的项
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }
      
      const parent = stack[stack.length - 1].obj;
      
      if (value === '' || value === '|') {
        // 嵌套对象或多行字符串
        parent[key] = value === '|' ? '' : {};
        stack.push({ indent, obj: parent, key });
      } else {
        parent[key] = parseValue(value);
        stack[stack.length - 1].key = key;
      }
    }
  }
  
  return result;
}

function parseValue(value: string): any {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
  // 移除引号
  if ((value.startsWith('"') && value.endsWith('"')) || 
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * 获取所有工作流列表
 */
export function listWorkflows(): Workflow[] {
  return skillsConfig ? Array.from(skillsConfig.workflows.values()) : [];
}

/**
 * 获取所有场景列表
 */
export function listScenarios(): Scenario[] {
  return skillsConfig ? Array.from(skillsConfig.scenarios.values()) : [];
}

/**
 * 重新加载技能配置
 */
export async function reloadSkills(skillsDir?: string): Promise<SkillsConfig> {
  skillsConfig = null;
  return loadSkills(skillsDir);
}
