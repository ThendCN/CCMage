const claudeCodeManager = require('./aiManager');

/**
 * DeepSeek 引擎包装器
 *
 * 这是一个基于 Claude Code Manager 的包装器，
 * 自动配置 DeepSeek 相关的环境变量
 */
class DeepSeekManager {
  constructor() {
    this.baseManager = claudeCodeManager;
  }

  /**
   * 执行 AI 任务（自动使用 DeepSeek 配置）
   */
  async execute(projectName, projectPath, prompt, sessionId, todoId = null, thinkingMode = false) {
    // 临时覆盖环境变量，优先使用 DeepSeek 配置
    const originalEnv = { ...process.env };

    try {
      // 强制使用 DeepSeek 配置
      if (process.env.DEEPSEEK_API_KEY) {
        process.env.ANTHROPIC_API_KEY = process.env.DEEPSEEK_API_KEY;
      }

      if (process.env.DEEPSEEK_BASE_URL) {
        process.env.ANTHROPIC_BASE_URL = process.env.DEEPSEEK_BASE_URL;
      } else {
        process.env.ANTHROPIC_BASE_URL = 'https://api.deepseek.com/anthropic';
      }

      // 设置默认模型（如果用户没有配置）
      if (!process.env.ANTHROPIC_MODEL || !process.env.ANTHROPIC_MODEL.toLowerCase().includes('deepseek')) {
        process.env.ANTHROPIC_MODEL = thinkingMode ? 'deepseek-reasoner' : 'DeepSeek-V3.2-Exp';
      }

      console.log('[DeepSeek] 🧠 使用 DeepSeek 引擎');
      console.log(`[DeepSeek]   - Model: ${process.env.ANTHROPIC_MODEL}`);
      console.log(`[DeepSeek]   - Base URL: ${process.env.ANTHROPIC_BASE_URL}`);
      console.log(`[DeepSeek]   - Thinking Mode: ${thinkingMode ? '开启' : '关闭'}`);

      // 调用基础管理器
      return await this.baseManager.execute(projectName, projectPath, prompt, sessionId, todoId, thinkingMode);
    } finally {
      // 恢复原始环境变量
      Object.keys(originalEnv).forEach(key => {
        process.env[key] = originalEnv[key];
      });
    }
  }

  /**
   * 获取会话状态（代理到基础管理器）
   */
  getSessionStatus(sessionId) {
    return this.baseManager.getSessionStatus(sessionId);
  }

  /**
   * 获取会话日志（代理到基础管理器）
   */
  getSessionLogs(sessionId, limit) {
    return this.baseManager.getSessionLogs(sessionId, limit);
  }

  /**
   * 终止会话（代理到基础管理器）
   */
  async terminateSession(sessionId) {
    return await this.baseManager.terminateSession(sessionId);
  }

  /**
   * 获取历史记录（代理到基础管理器）
   */
  getHistory(projectName, limit) {
    return this.baseManager.getHistory(projectName, limit);
  }

  /**
   * 获取历史记录详情（代理到基础管理器）
   */
  getHistoryDetail(projectName, recordId) {
    return this.baseManager.getHistoryDetail(projectName, recordId);
  }

  /**
   * 清空历史记录（代理到基础管理器）
   */
  clearHistory(projectName) {
    return this.baseManager.clearHistory(projectName);
  }

  /**
   * 获取所有活跃会话（代理到基础管理器）
   */
  getActiveSessions() {
    return this.baseManager.getActiveSessions();
  }

  /**
   * 检查 DeepSeek 是否可用
   */
  async checkDeepSeekAvailable() {
    if (!process.env.DEEPSEEK_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      throw new Error('DeepSeek API Key 未配置（需要 DEEPSEEK_API_KEY 或 ANTHROPIC_API_KEY）');
    }

    // 检查 SDK 是否可用
    return await this.baseManager.checkClaudeAvailable();
  }

  /**
   * 事件监听（代理到基础管理器）
   */
  on(eventName, handler) {
    this.baseManager.on(eventName, handler);
  }

  off(eventName, handler) {
    this.baseManager.off(eventName, handler);
  }

  emit(eventName, ...args) {
    this.baseManager.emit(eventName, ...args);
  }
}

module.exports = new DeepSeekManager();
