/**
 * AI 引擎工厂 - 统一管理多个 AI 引擎
 *
 * 支持的引擎:
 * - claude-code: Claude Code (使用 @anthropic-ai/claude-agent-sdk)
 * - deepseek: DeepSeek (基于 Claude SDK，自动配置 DeepSeek API)
 * - codex: OpenAI Codex (使用 @openai/codex-sdk)
 */

const claudeCodeManager = require('./aiManager');
const deepseekManager = require('./deepseekManager');
const codexManager = require('./codexManager');

class AIEngineFactory {
  constructor() {
    this.engines = {
      'claude-code': claudeCodeManager,
      'deepseek': deepseekManager,
      'codex': codexManager
    };
    this.defaultEngine = process.env.DEFAULT_AI_ENGINE || 'claude-code';
  }

  /**
   * 获取指定引擎的管理器
   * @param {string} engine - 引擎名称 ('claude-code' | 'codex')
   * @returns {Object} 对应的管理器实例
   */
  getEngine(engine) {
    const engineName = engine || this.defaultEngine;

    if (!this.engines[engineName]) {
      throw new Error(`不支持的 AI 引擎: ${engineName}. 支持的引擎: ${Object.keys(this.engines).join(', ')}`);
    }

    return this.engines[engineName];
  }

  /**
   * 获取默认引擎
   */
  getDefaultEngine() {
    return this.engines[this.defaultEngine];
  }

  /**
   * 获取所有可用引擎列表
   */
  getAvailableEngines() {
    return Object.keys(this.engines).map(name => ({
      name,
      displayName: this.getEngineDisplayName(name),
      isDefault: name === this.defaultEngine
    }));
  }

  /**
   * 获取引擎的显示名称
   */
  getEngineDisplayName(engine) {
    const displayNames = {
      'claude-code': 'Claude Code',
      'deepseek': 'Claude Code - DeepSeek',
      'codex': 'OpenAI Codex'
    };
    return displayNames[engine] || engine;
  }

  /**
   * 检查引擎是否可用
   */
  async checkEngineAvailable(engine) {
    try {
      const manager = this.getEngine(engine);

      // 根据不同的引擎调用不同的检查方法
      if (engine === 'claude-code' && manager.checkClaudeAvailable) {
        return await manager.checkClaudeAvailable();
      } else if (engine === 'deepseek' && manager.checkDeepSeekAvailable) {
        return await manager.checkDeepSeekAvailable();
      } else if (engine === 'codex' && manager.checkCodexAvailable) {
        return await manager.checkCodexAvailable();
      }

      return true;
    } catch (error) {
      console.error(`[AIEngineFactory] 检查引擎失败 (${engine}):`, error);
      return false;
    }
  }

  /**
   * 执行 AI 任务
   * @param {number} todoId - 可选，关联到特定任务
   * @param {boolean} thinkingMode - 可选，是否开启思考模式（DeepSeek Reasoner）
   */
  async execute(engine, projectName, projectPath, prompt, sessionId, todoId = null, thinkingMode = false) {
    const manager = this.getEngine(engine);
    return await manager.execute(projectName, projectPath, prompt, sessionId, todoId, thinkingMode);
  }

  /**
   * 获取会话状态
   */
  getSessionStatus(engine, sessionId) {
    const manager = this.getEngine(engine);
    return manager.getSessionStatus(sessionId);
  }

  /**
   * 获取会话日志
   */
  getSessionLogs(engine, sessionId, limit) {
    const manager = this.getEngine(engine);
    return manager.getSessionLogs(sessionId, limit);
  }

  /**
   * 终止会话
   */
  async terminateSession(engine, sessionId) {
    const manager = this.getEngine(engine);
    return await manager.terminateSession(sessionId);
  }

  /**
   * 获取历史记录
   */
  getHistory(engine, projectName, limit) {
    const manager = this.getEngine(engine);
    return manager.getHistory(projectName, limit);
  }

  /**
   * 获取历史记录详情
   */
  getHistoryDetail(engine, projectName, recordId) {
    const manager = this.getEngine(engine);
    return manager.getHistoryDetail(projectName, recordId);
  }

  /**
   * 清空历史记录
   */
  clearHistory(engine, projectName) {
    const manager = this.getEngine(engine);
    return manager.clearHistory(projectName);
  }

  /**
   * 获取所有活跃会话
   */
  getActiveSessions(engine) {
    const manager = this.getEngine(engine);
    return manager.getActiveSessions();
  }

  /**
   * 监听引擎事件（代理到具体引擎）
   */
  on(engine, eventName, handler) {
    const manager = this.getEngine(engine);
    manager.on(eventName, handler);
  }

  /**
   * 移除引擎事件监听（代理到具体引擎）
   */
  off(engine, eventName, handler) {
    const manager = this.getEngine(engine);
    manager.off(eventName, handler);
  }

  /**
   * 触发引擎事件（代理到具体引擎）
   */
  emit(engine, eventName, ...args) {
    const manager = this.getEngine(engine);
    manager.emit(eventName, ...args);
  }
}

module.exports = new AIEngineFactory();
