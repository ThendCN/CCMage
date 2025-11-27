const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

/**
 * Claude Code SDK 管理器 - 使用 Claude Agent SDK 执行 AI 编程任务
 */
class ClaudeCodeManager extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map(); // { sessionId: { query, logs, startTime, projectName } }
    this.history = new Map(); // { projectName: [{ id, prompt, timestamp, success, logs }] }
    this.maxHistoryPerProject = 20; // 每个项目最多保存20条历史记录
    this.sdkModule = null; // 延迟加载的 SDK 模块
    this.historyFilePath = path.join(__dirname, 'ai-history.json'); // 历史记录文件路径

    // 启动时加载历史记录
    this.loadHistoryFromFile();
  }

  /**
   * 动态导入 Claude Agent SDK (ESM)
   */
  async loadSDK() {
    if (!this.sdkModule) {
      console.log('[AI] 🔄 动态加载 Claude Agent SDK...');
      try {
        this.sdkModule = await import('@anthropic-ai/claude-agent-sdk');
        console.log('[AI] ✅ Claude Agent SDK 加载成功');
      } catch (error) {
        console.error('[AI] ❌ 加载 Claude Agent SDK 失败:', error);
        throw new Error('无法加载 Claude Agent SDK: ' + error.message);
      }
    }
    return this.sdkModule;
  }

  /**
   * 执行 Claude Code 任务（使用 SDK）
   */
  async execute(projectName, projectPath, prompt, sessionId) {
    if (!sessionId) {
      sessionId = `${projectName}-${Date.now()}`;
    }

    console.log(`[AI] 🚀 开始执行 AI 任务 (SDK 模式)`);
    console.log(`[AI]   - sessionId: ${sessionId}`);
    console.log(`[AI]   - projectName: ${projectName}`);
    console.log(`[AI]   - projectPath: ${projectPath}`);
    console.log(`[AI]   - prompt: ${prompt}`);

    const logs = [];
    const startTime = Date.now();

    try {
      // 加载 SDK
      const sdk = await this.loadSDK();
      console.log('[AI] ✅ SDK 模块已加载');

      // 创建 query
      console.log('[AI] 📝 创建 query 实例...');
      const queryInstance = sdk.query({
        prompt: prompt,
        options: {
          cwd: projectPath,
          settingSources: ['project', 'user'],
          systemPrompt: {
            type: 'preset',
            preset: 'claude_code'
          },
          env: { ...process.env },
          maxTurns: 50, // 最大轮次限制
        }
      });

      console.log('[AI] ✅ Query 实例已创建');

      // 保存会话信息
      console.log(`[AI] 💾 保存会话信息: ${sessionId}`);
      this.sessions.set(sessionId, {
        query: queryInstance,
        logs,
        startTime,
        projectName,
        prompt
      });

      // 异步处理消息流
      this.processQueryStream(queryInstance, sessionId, logs, startTime, projectName, prompt);

      // 立即返回会话信息（不等待完成）
      return {
        sessionId,
        message: 'AI 任务已启动',
        startTime
      };

    } catch (error) {
      console.error(`[AI] ❌ 启动任务失败: ${sessionId}`, error);
      throw error;
    }
  }

  /**
   * 处理 query 的消息流
   */
  async processQueryStream(queryInstance, sessionId, logs, startTime, projectName, prompt) {
    try {
      console.log(`[AI] 📡 开始处理消息流: ${sessionId}`);

      let messageCount = 0;
      let lastMessageTime = Date.now();

      // 使用 for await...of 迭代异步生成器
      for await (const message of queryInstance) {
        messageCount++;
        const currentTime = Date.now();
        const timeSinceLastMessage = currentTime - lastMessageTime;

        console.log(`[AI] 📨 收到第 ${messageCount} 条消息`);
        console.log(`[AI]   - 消息类型: ${message.type}`);
        console.log(`[AI]   - 距上条消息: ${timeSinceLastMessage}ms`);

        // 将消息转换为日志条目
        const logEntry = this.messageToLogEntry(message, sessionId);

        // 如果消息被过滤（返回 null），跳过
        if (!logEntry) {
          console.log(`[AI]   - 消息已被过滤（系统配置信息）`);
          lastMessageTime = currentTime;
          continue;
        }

        // 打印消息内容的前50个字符用于调试
        console.log(`[AI]   - 内容预览: ${logEntry.content?.substring(0, 50)}...`);

        logs.push(logEntry);

        // 发送到前端（通过 EventEmitter）
        console.log(`[AI] 📡 发送 EventEmitter 事件: ai-output:${sessionId}`);
        this.emit(`ai-output:${sessionId}`, logEntry);

        lastMessageTime = currentTime;
      }

      // 流结束，任务完成
      const endTime = Date.now();
      const duration = endTime - startTime;
      console.log(`[AI] 🏁 消息流结束: ${sessionId}`);
      console.log(`[AI]   - 总消息数: ${messageCount}`);
      console.log(`[AI]   - 执行时长: ${duration}ms`);

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
      console.log(`[AI] 💾 保存到历史记录: ${projectName}`);
      this.addToHistory(projectName, {
        id: sessionId,
        prompt,
        timestamp: startTime,
        success: true,
        logs,
        duration
      });

      // 发送完成事件
      console.log(`[AI] 📡 发送完成事件: ai-complete:${sessionId}`);
      this.emit(`ai-complete:${sessionId}`, result);

      // 清理会话
      console.log(`[AI] 🧹 清理会话: ${sessionId}`);
      this.sessions.delete(sessionId);

    } catch (error) {
      console.error(`[AI] ❌ 处理消息流出错: ${sessionId}`, error);

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
        duration
      });

      // 发送完成事件（失败）
      this.emit(`ai-complete:${sessionId}`, result);

      // 清理会话
      this.sessions.delete(sessionId);
    }
  }

  /**
   * 将 SDK 消息转换为日志条目（基于官方 SDKMessage 类型）
   */
  messageToLogEntry(message, sessionId) {
    const entry = {
      time: Date.now(),
      sessionId,
      messageType: message.type
    };

    // 根据 SDKMessage 类型定义处理消息
    switch (message.type) {
      case 'assistant': {
        // SDKAssistantMessage - AI 的完整回复
        // 从 message.message.content 数组中提取文本和工具调用
        const textContent = this.extractAssistantText(message);
        if (!textContent || textContent.trim() === '') {
          return null; // 完全空的消息
        }
        entry.type = 'stdout';
        entry.content = textContent;
        break;
      }

      case 'user': {
        // SDKUserMessage - 显示工具结果
        if (message.isSynthetic && message.tool_use_result) {
          // 这是工具执行的结果
          entry.type = 'stdout';
          entry.content = this.formatToolResult(message.tool_use_result);
          break;
        }
        // 真实用户消息不需要显示（前端已经显示过了）
        return null;
      }

      case 'result': {
        // SDKResultMessage - 最终执行结果
        if (message.subtype === 'success') {
          // 成功完成 - 可以显示统计信息
          entry.type = 'stdout';
          entry.content = `\n---\n✅ **任务完成**\n- 执行时长: ${(message.duration_ms / 1000).toFixed(2)}秒\n- API 调用: ${(message.duration_api_ms / 1000).toFixed(2)}秒\n- 轮次: ${message.num_turns}\n- 费用: $${message.total_cost_usd.toFixed(4)}`;
        } else {
          // 执行出错
          entry.type = 'stderr';
          const errorType = {
            'error_during_execution': '执行过程中出错',
            'error_max_turns': '达到最大轮次限制',
            'error_max_budget_usd': '达到预算限制',
            'error_max_structured_output_retries': '结构化输出重试次数超限'
          }[message.subtype] || '未知错误';

          entry.content = `\n---\n❌ **${errorType}**\n${message.errors ? message.errors.join('\n') : ''}`;
        }
        break;
      }

      case 'system': {
        // SDKSystemMessage 有多种 subtype
        if (message.subtype === 'init') {
          // 初始化消息 - 跳过（包含大量配置信息）
          return null;
        } else if (message.subtype === 'status') {
          // 状态消息 - 跳过
          return null;
        } else if (message.subtype === 'compact_boundary') {
          // 压缩边界 - 跳过
          return null;
        } else if (message.subtype === 'hook_response') {
          // Hook 响应 - 跳过
          return null;
        }
        // 其他系统消息也跳过
        return null;
      }

      case 'stream_event': {
        // SDKPartialAssistantMessage - 流式事件（已经通过 assistant 消息处理）
        return null;
      }

      case 'tool_progress': {
        // SDKToolProgressMessage - 工具进度（不显示给用户）
        return null;
      }

      case 'auth_status': {
        // SDKAuthStatusMessage - 认证状态（不显示给用户）
        return null;
      }

      default: {
        // 未知消息类型 - 记录警告
        console.warn(`[AI] ⚠️ 未知的消息类型: ${message.type}`, message);
        return null;
      }
    }

    return entry;
  }

  /**
   * 从 SDKAssistantMessage 中提取并格式化内容（包括工具调用）
   */
  extractAssistantText(assistantMessage) {
    // assistantMessage.message 是 APIAssistantMessage
    const apiMessage = assistantMessage.message;

    if (!apiMessage || !apiMessage.content) {
      return '';
    }

    // content 是一个数组，可能包含 text, tool_use, tool_result 等 blocks
    if (Array.isArray(apiMessage.content)) {
      return apiMessage.content
        .map(block => {
          if (block.type === 'text') {
            // 文本块 - 直接返回
            return block.text;
          } else if (block.type === 'tool_use') {
            // 工具调用 - 格式化成友好的消息
            return this.formatToolUse(block);
          }
          // 其他类型暂不处理
          return '';
        })
        .filter(content => content.trim() !== '')
        .join('\n\n');
    }

    return '';
  }

  /**
   * 格式化工具调用为友好的消息
   */
  formatToolUse(toolBlock) {
    const { name, input } = toolBlock;

    // 根据不同的工具类型，生成友好的描述
    const toolDescriptions = {
      'Read': () => {
        const path = input.file_path || input.path;
        return `📖 **正在读取文件**\n\`${path}\``;
      },
      'Write': () => {
        const path = input.file_path || input.path;
        return `✍️ **正在写入文件**\n\`${path}\``;
      },
      'Edit': () => {
        const path = input.file_path || input.path;
        return `✏️ **正在编辑文件**\n\`${path}\``;
      },
      'Bash': () => {
        const cmd = input.command;
        return `⚙️ **正在执行命令**\n\`\`\`bash\n${cmd}\n\`\`\``;
      },
      'Glob': () => {
        const pattern = input.pattern;
        return `🔍 **正在搜索文件**\n模式: \`${pattern}\``;
      },
      'Grep': () => {
        const pattern = input.pattern;
        return `🔎 **正在搜索内容**\n模式: \`${pattern}\``;
      },
      'Task': () => {
        const desc = input.description || '子任务';
        return `🤖 **启动子代理**\n任务: ${desc}`;
      },
      'TodoWrite': () => {
        return `📝 **更新任务列表**`;
      },
      'WebFetch': () => {
        const url = input.url;
        return `🌐 **正在访问网页**\n${url}`;
      },
      'WebSearch': () => {
        const query = input.query;
        return `🔍 **正在搜索**\n"${query}"`;
      }
    };

    // 如果有对应的格式化函数，使用它；否则使用通用格式
    if (toolDescriptions[name]) {
      return toolDescriptions[name]();
    }

    // 通用格式
    return `🔧 **调用工具: ${name}**\n\`\`\`json\n${JSON.stringify(input, null, 2)}\n\`\`\``;
  }

  /**
   * 格式化工具执行结果
   */
  formatToolResult(result) {
    // result 的格式取决于工具类型
    if (!result) {
      return '✅ **执行完成**';
    }

    // 如果结果是字符串且很长，只显示摘要
    if (typeof result === 'string') {
      const lines = result.split('\n');
      if (lines.length > 10 || result.length > 500) {
        return `✅ **执行完成**\n<details>\n<summary>查看结果 (${lines.length} 行)</summary>\n\n\`\`\`\n${lines.slice(0, 5).join('\n')}\n... (${lines.length - 5} 行更多内容)\n\`\`\`\n</details>`;
      }
      return `✅ **执行完成**\n\`\`\`\n${result}\n\`\`\``;
    }

    // 如果结果是对象
    if (typeof result === 'object') {
      // 检查是否有特定字段
      if (result.type === 'text' && result.file) {
        // 文件读取结果
        const { file } = result;
        return `✅ **文件已读取**\n- 路径: \`${file.filePath}\`\n- 行数: ${file.numLines}`;
      }

      if (result.stdout || result.stderr) {
        // 命令执行结果
        const output = result.stdout || result.stderr;
        const lines = output.split('\n');
        if (lines.length > 5) {
          return `✅ **命令执行完成**\n\`\`\`\n${lines.slice(0, 3).join('\n')}\n...\n\`\`\``;
        }
        return `✅ **命令执行完成**\n\`\`\`\n${output}\n\`\`\``;
      }

      // 其他对象结果
      const jsonStr = JSON.stringify(result, null, 2);
      if (jsonStr.length > 500) {
        return `✅ **执行完成**\n\`\`\`json\n${jsonStr.substring(0, 200)}...\n\`\`\``;
      }
      return `✅ **执行完成**\n\`\`\`json\n${jsonStr}\n\`\`\``;
    }

    return `✅ **执行完成**\n${String(result)}`;
  }

  /**
   * 检查 Claude Code CLI 是否可用（SDK 模式下不需要）
   */
  async checkClaudeAvailable() {
    try {
      await this.loadSDK();
      return true;
    } catch (error) {
      throw new Error('Claude Agent SDK 不可用: ' + error.message);
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
      // SDK 的 query 有 interrupt 方法
      if (session.query && typeof session.query.interrupt === 'function') {
        console.log(`[AI] 🛑 中断会话: ${sessionId}`);
        await session.query.interrupt();
      }

      this.sessions.delete(sessionId);
      return { success: true, message: '会话已终止' };
    } catch (error) {
      console.error(`[AI] ❌ 终止会话失败: ${sessionId}`, error);
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
    projectHistory.unshift(record); // 添加到开头

    // 限制历史记录数量
    if (projectHistory.length > this.maxHistoryPerProject) {
      projectHistory.pop();
    }

    // 保存到文件
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
    // 保存到文件
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

        // 将对象转换为 Map
        this.history = new Map(Object.entries(historyData));
        console.log(`[AI] ✅ 从文件加载历史记录: ${this.history.size} 个项目`);
      } else {
        console.log('[AI] ℹ️ 历史记录文件不存在，创建新的');
      }
    } catch (error) {
      console.error('[AI] ❌ 加载历史记录失败:', error);
      this.history = new Map();
    }
  }

  /**
   * 保存历史记录到文件
   */
  saveHistoryToFile() {
    try {
      // 将 Map 转换为对象
      const historyObj = Object.fromEntries(this.history);
      fs.writeFileSync(this.historyFilePath, JSON.stringify(historyObj, null, 2), 'utf8');
      console.log('[AI] 💾 历史记录已保存到文件');
    } catch (error) {
      console.error('[AI] ❌ 保存历史记录失败:', error);
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

module.exports = new ClaudeCodeManager();
