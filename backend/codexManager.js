const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

/**
 * OpenAI Codex SDK 管理器 - 使用 Codex SDK 执行 AI 编程任务
 */
class CodexManager extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map(); // { sessionId: { thread, logs, startTime, projectName } }
    this.history = new Map(); // { projectName: [{ id, prompt, timestamp, success, logs }] }
    this.maxHistoryPerProject = 20;
    this.sdkModule = null; // 延迟加载的 Codex SDK 模块
    this.historyFilePath = path.join(__dirname, 'codex-history.json');

    // 启动时加载历史记录
    this.loadHistoryFromFile();
  }

  /**
   * 动态导入 Codex SDK (ESM)
   */
  async loadSDK() {
    if (!this.sdkModule) {
      console.log('[Codex] 🔄 动态加载 Codex SDK...');
      try {
        this.sdkModule = await import('@openai/codex-sdk');
        console.log('[Codex] ✅ Codex SDK 加载成功');
      } catch (error) {
        console.error('[Codex] ❌ 加载 Codex SDK 失败:', error);
        throw new Error('无法加载 Codex SDK: ' + error.message);
      }
    }
    return this.sdkModule;
  }

  /**
   * 执行 Codex 任务（使用 SDK）
   * @param {string} sessionId - 如果提供已存在的 sessionId，将在现有线程上继续对话
   * @param {number} todoId - 可选，关联到特定任务（Codex 暂不使用此参数）
   */
  async execute(projectName, projectPath, prompt, sessionId, todoId = null) {
    console.log(`[Codex] 🚀 开始执行 AI 任务 (Codex SDK 模式)`);
    console.log(`[Codex]   - sessionId: ${sessionId || '(新会话)'}`);
    console.log(`[Codex]   - projectName: ${projectName}`);
    console.log(`[Codex]   - projectPath: ${projectPath}`);
    console.log(`[Codex]   - todoId: ${todoId || '(无关联任务)'}`);
    console.log(`[Codex]   - prompt: ${prompt}`);

    // 检查是否是现有会话
    const existingSession = sessionId ? this.sessions.get(sessionId) : null;

    if (existingSession) {
      console.log(`[Codex] 🔄 复用现有会话: ${sessionId}`);
      // 在现有线程上继续对话
      return await this.continueConversation(existingSession, prompt, sessionId);
    }

    // 创建新会话
    if (!sessionId) {
      sessionId = `codex-${projectName}-${Date.now()}`;
    }

    const logs = [];
    const startTime = Date.now();

    try {
      // 加载 SDK
      const sdk = await this.loadSDK();
      const { Codex } = sdk;
      console.log('[Codex] ✅ SDK 模块已加载');

      // 创建 Codex 实例
      console.log('[Codex] 📝 创建 Codex 实例...');
      const codex = new Codex({
        // 如果设置了 OPENAI_API_KEY，会自动使用
        // 否则会使用用户登录的 ChatGPT 账号
      });

      // 启动线程
      console.log('[Codex] 🧵 启动线程...');
      const thread = await codex.startThread({
        workingDirectory: projectPath,
        skipGitRepoCheck: true, // 允许非 Git 仓库
      });

      console.log('[Codex] ✅ 线程已创建');

      // 保存会话信息
      console.log(`[Codex] 💾 保存会话信息: ${sessionId}`);
      this.sessions.set(sessionId, {
        thread,
        logs,
        startTime,
        projectName,
        projectPath,
        prompt
      });

      // 异步处理流式输出
      this.processCodexStream(thread, prompt, sessionId, logs, startTime, projectName);

      // 立即返回会话信息（不等待完成）
      return {
        sessionId,
        message: 'Codex 任务已启动',
        startTime
      };

    } catch (error) {
      console.error(`[Codex] ❌ 启动任务失败: ${sessionId}`, error);
      throw error;
    }
  }

  /**
   * 在现有会话上继续对话
   */
  async continueConversation(session, prompt, sessionId) {
    console.log(`[Codex] 💬 在现有线程上继续对话: ${sessionId}`);

    const startTime = Date.now();
    session.prompt = prompt; // 更新最新的 prompt

    try {
      // 在现有线程上运行新的 turn
      this.processCodexStream(session.thread, prompt, sessionId, session.logs, startTime, session.projectName);

      return {
        sessionId,
        message: 'Codex 任务已启动（继续会话）',
        startTime
      };
    } catch (error) {
      console.error(`[Codex] ❌ 继续对话失败: ${sessionId}`, error);
      throw error;
    }
  }

  /**
   * 处理 Codex 的流式输出
   */
  async processCodexStream(thread, prompt, sessionId, logs, startTime, projectName) {
    try {
      console.log(`[Codex] 📡 开始处理流式输出: ${sessionId}`);

      let messageCount = 0;
      let lastMessageTime = Date.now();

      // 使用 runStreamed 获取流式事件
      const { events } = await thread.runStreamed(prompt);

      // 迭代流式事件
      for await (const event of events) {
        messageCount++;
        const currentTime = Date.now();
        const timeSinceLastMessage = currentTime - lastMessageTime;

        console.log(`[Codex] 📨 收到第 ${messageCount} 条事件`);
        console.log(`[Codex]   - 事件类型: ${event.type}`);
        console.log(`[Codex]   - 距上条事件: ${timeSinceLastMessage}ms`);

        // 将事件转换为日志条目
        const logEntry = this.eventToLogEntry(event, sessionId);

        // 如果事件被过滤（返回 null），跳过
        if (!logEntry) {
          console.log(`[Codex]   - 事件已被过滤: ${event.type}`);
          lastMessageTime = currentTime;
          continue;
        }

        console.log(`[Codex]   - 内容预览: ${logEntry.content?.substring(0, 50)}...`);

        logs.push(logEntry);

        // 发送到前端（通过 EventEmitter）
        console.log(`[Codex] 📡 发送 EventEmitter 事件: ai-output:${sessionId}`);
        this.emit(`ai-output:${sessionId}`, logEntry);

        lastMessageTime = currentTime;
      }

      // 流结束，任务完成
      const endTime = Date.now();
      const duration = endTime - startTime;
      console.log(`[Codex] 🏁 流式输出结束: ${sessionId}`);
      console.log(`[Codex]   - 总事件数: ${messageCount}`);
      console.log(`[Codex]   - 执行时长: ${duration}ms`);

      const result = {
        sessionId,
        success: true,
        exitCode: 0,
        logs,
        duration,
        startTime,
        endTime
      };

      // 保存到历史记录
      console.log(`[Codex] 💾 保存到历史记录: ${projectName}`);
      this.addToHistory(projectName, {
        id: sessionId,
        prompt,
        timestamp: startTime,
        success: true,
        logs,
        duration,
        engine: 'codex'
      });

      // 发送完成事件
      console.log(`[Codex] 📡 发送完成事件: ai-complete:${sessionId}`);
      this.emit(`ai-complete:${sessionId}`, result);

      // ⚠️ 注意：不清理会话，保持线程以便继续对话
      // 用户可以通过 terminateSession 手动终止
      console.log(`[Codex] ✅ 会话保持活跃，可以继续对话: ${sessionId}`);

    } catch (error) {
      console.error(`[Codex] ❌ 处理流式输出出错: ${sessionId}`, error);

      const endTime = Date.now();
      const duration = endTime - startTime;

      const result = {
        sessionId,
        success: false,
        error: error.message,
        logs,
        duration,
        startTime,
        endTime
      };

      // 保存失败记录
      this.addToHistory(projectName, {
        id: sessionId,
        prompt,
        timestamp: startTime,
        success: false,
        logs,
        duration,
        engine: 'codex'
      });

      // 发送完成事件（失败）
      this.emit(`ai-complete:${sessionId}`, result);

      // ⚠️ 注意：即使失败也不清理会话，允许用户继续尝试
      console.log(`[Codex] ⚠️ 会话保持活跃（失败），用户可以继续尝试: ${sessionId}`);
    }
  }

  /**
   * 将 Codex 事件转换为日志条目
   */
  eventToLogEntry(event, sessionId) {
    const entry = {
      time: Date.now(),
      sessionId,
      eventType: event.type
    };

    // 根据 Codex 事件类型处理
    switch (event.type) {
      case 'thread.started':
        entry.type = 'stdout';
        entry.content = `🧵 **线程已启动**\nID: ${event.thread_id}`;
        break;

      case 'turn.started':
        entry.type = 'stdout';
        entry.content = `🔄 **开始处理**`;
        break;

      case 'turn.completed':
        entry.type = 'stdout';
        entry.content = `✅ **处理完成**\n使用 Token: 输入 ${event.usage.input_tokens} (缓存 ${event.usage.cached_input_tokens}), 输出 ${event.usage.output_tokens}`;
        break;

      case 'turn.failed':
        entry.type = 'stderr';
        entry.content = `❌ **处理失败**: ${event.error.message}`;
        break;

      case 'item.started':
        entry.type = 'stdout';
        entry.content = this.formatItemStarted(event.item);
        break;

      case 'item.updated':
        entry.type = 'stdout';
        entry.content = this.formatItemUpdated(event.item);
        break;

      case 'item.completed':
        entry.type = 'stdout';
        entry.content = this.formatItemCompleted(event.item);
        break;

      case 'error':
        entry.type = 'stderr';
        entry.content = `❌ **错误**: ${event.message}`;
        break;

      default:
        console.warn(`[Codex] ⚠️ 未知的事件类型: ${event.type}`, event);
        return null;
    }

    return entry;
  }

  /**
   * 格式化 item.started 事件
   */
  formatItemStarted(item) {
    switch (item.type) {
      case 'agent_message':
        return `💬 **AI 正在回复**...`;
      case 'reasoning':
        return `🤔 **AI 正在思考**...`;
      case 'command_execution':
        return `⚙️ **正在执行命令**\n\`\`\`bash\n${item.command}\n\`\`\``;
      case 'file_change':
        return `📝 **正在修改文件**...`;
      case 'mcp_tool_call':
        return `🔧 **调用工具**: ${item.server}/${item.tool}`;
      case 'web_search':
        return `🔍 **正在搜索**: ${item.query}`;
      case 'todo_list':
        return `📋 **待办事项**`;
      case 'error':
        return `⚠️ **错误**: ${item.message}`;
      default:
        return `🔵 **新项目**: ${item.type}`;
    }
  }

  /**
   * 格式化 item.updated 事件
   */
  formatItemUpdated(item) {
    switch (item.type) {
      case 'agent_message':
        // 流式输出文本（最多显示最后 100 字符）
        const preview = item.text.length > 100 ? '...' + item.text.slice(-100) : item.text;
        return `💬 ${preview}`;
      case 'reasoning':
        return `🤔 ${item.text.slice(0, 100)}${item.text.length > 100 ? '...' : ''}`;
      case 'command_execution':
        if (item.aggregated_output) {
          const lines = item.aggregated_output.split('\n').slice(-3);
          return `⚙️ **命令输出**\n\`\`\`\n${lines.join('\n')}\n\`\`\``;
        }
        return `⚙️ **命令运行中**...`;
      case 'todo_list':
        const summary = item.items.map(t => `${t.completed ? '✅' : '⬜'} ${t.text}`).join('\n');
        return `📋 **待办事项**\n${summary}`;
      default:
        return null; // 跳过其他更新事件
    }
  }

  /**
   * 格式化 item.completed 事件
   */
  formatItemCompleted(item) {
    switch (item.type) {
      case 'agent_message':
        return `💬 **AI 回复**\n${item.text}`;
      case 'reasoning':
        return `🤔 **思考过程**\n${item.text}`;
      case 'command_execution':
        const status = item.status === 'completed' ? '✅' : '❌';
        const exitInfo = item.exit_code !== undefined ? ` (退出码: ${item.exit_code})` : '';
        let output = `${status} **命令执行${item.status === 'completed' ? '成功' : '失败'}**${exitInfo}\n\`\`\`bash\n${item.command}\n\`\`\``;
        if (item.aggregated_output) {
          const lines = item.aggregated_output.split('\n');
          if (lines.length > 10 || item.aggregated_output.length > 1000) {
            output += `\n\`\`\`\n${lines.slice(0, 3).join('\n')}\n...\n${lines.slice(-3).join('\n')}\n\`\`\``;
          } else {
            output += `\n\`\`\`\n${item.aggregated_output}\n\`\`\``;
          }
        }
        return output;
      case 'file_change':
        const changeStatus = item.status === 'completed' ? '✅' : '❌';
        const changes = item.changes.map(c => `  ${c.kind === 'add' ? '➕' : c.kind === 'delete' ? '➖' : '✏️'} \`${c.path}\``).join('\n');
        return `${changeStatus} **文件变更${item.status === 'completed' ? '成功' : '失败'}**\n${changes}`;
      case 'mcp_tool_call':
        const toolStatus = item.status === 'completed' ? '✅' : '❌';
        let toolOutput = `${toolStatus} **工具调用**: ${item.server}/${item.tool}`;
        if (item.error) {
          toolOutput += `\n错误: ${item.error.message}`;
        } else if (item.result && item.result.structured_content) {
          const resultStr = JSON.stringify(item.result.structured_content, null, 2);
          if (resultStr.length > 500) {
            toolOutput += `\n\`\`\`json\n${resultStr.substring(0, 200)}...\n\`\`\``;
          } else {
            toolOutput += `\n\`\`\`json\n${resultStr}\n\`\`\``;
          }
        }
        return toolOutput;
      case 'web_search':
        return `🔍 **搜索完成**: ${item.query}`;
      case 'todo_list':
        const todos = item.items.map(t => `${t.completed ? '✅' : '⬜'} ${t.text}`).join('\n');
        return `📋 **待办事项**\n${todos}`;
      case 'error':
        return `❌ **错误**: ${item.message}`;
      default:
        return `✅ **完成**: ${item.type}`;
    }
  }

  /**
   * 检查 Codex SDK 是否可用
   */
  async checkCodexAvailable() {
    try {
      await this.loadSDK();
      return true;
    } catch (error) {
      throw new Error('Codex SDK 不可用: ' + error.message);
    }
  }

  /**
   * 获取会话状态
   */
  getSessionStatus(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { running: false };
    }

    return {
      running: true,
      projectName: session.projectName,
      prompt: session.prompt,
      startTime: session.startTime,
      uptime: Date.now() - session.startTime,
      logCount: session.logs.length
    };
  }

  /**
   * 获取会话日志
   */
  getSessionLogs(sessionId, limit = 100) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }

    return session.logs.slice(-limit);
  }

  /**
   * 终止会话
   */
  async terminateSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`会话 ${sessionId} 不存在`);
    }

    try {
      // Codex thread 有 abort 方法
      if (session.thread && typeof session.thread.abort === 'function') {
        console.log(`[Codex] 🛑 中止会话: ${sessionId}`);
        await session.thread.abort();
      }

      this.sessions.delete(sessionId);
      return { success: true, message: '会话已终止' };
    } catch (error) {
      console.error(`[Codex] ❌ 终止会话失败: ${sessionId}`, error);
      // 强制删除会话
      this.sessions.delete(sessionId);
      return { success: true, message: '会话已强制终止' };
    }
  }

  /**
   * 添加到历史记录
   */
  addToHistory(projectName, record) {
    if (!this.history.has(projectName)) {
      this.history.set(projectName, []);
    }

    const projectHistory = this.history.get(projectName);
    projectHistory.unshift(record);

    if (projectHistory.length > this.maxHistoryPerProject) {
      projectHistory.pop();
    }

    this.saveHistoryToFile();
  }

  /**
   * 获取项目的历史记录
   */
  getHistory(projectName, limit = 10) {
    const projectHistory = this.history.get(projectName) || [];
    return projectHistory.slice(0, limit);
  }

  /**
   * 获取历史记录详情
   */
  getHistoryDetail(projectName, recordId) {
    const projectHistory = this.history.get(projectName) || [];
    return projectHistory.find(record => record.id === recordId);
  }

  /**
   * 清空项目的历史记录
   */
  clearHistory(projectName) {
    this.history.set(projectName, []);
    this.saveHistoryToFile();
    return { success: true, message: '历史记录已清空' };
  }

  /**
   * 从文件加载历史记录
   */
  loadHistoryFromFile() {
    try {
      if (fs.existsSync(this.historyFilePath)) {
        const data = fs.readFileSync(this.historyFilePath, 'utf8');
        const historyData = JSON.parse(data);
        this.history = new Map(Object.entries(historyData));
        console.log(`[Codex] ✅ 从文件加载历史记录: ${this.history.size} 个项目`);
      } else {
        console.log('[Codex] ℹ️ 历史记录文件不存在，创建新的');
      }
    } catch (error) {
      console.error('[Codex] ❌ 加载历史记录失败:', error);
      this.history = new Map();
    }
  }

  /**
   * 保存历史记录到文件
   */
  saveHistoryToFile() {
    try {
      const historyObj = Object.fromEntries(this.history);
      fs.writeFileSync(this.historyFilePath, JSON.stringify(historyObj, null, 2), 'utf8');
      console.log('[Codex] 💾 历史记录已保存到文件');
    } catch (error) {
      console.error('[Codex] ❌ 保存历史记录失败:', error);
    }
  }

  /**
   * 获取所有活跃会话
   */
  getActiveSessions() {
    const sessions = [];
    this.sessions.forEach((session, sessionId) => {
      sessions.push({
        sessionId,
        projectName: session.projectName,
        prompt: session.prompt,
        startTime: session.startTime,
        uptime: Date.now() - session.startTime
      });
    });
    return sessions;
  }
}

module.exports = new CodexManager();
