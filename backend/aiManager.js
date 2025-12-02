const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const db = require('./database');
const { calculateCost, extractTokenUsage } = require('./aiCostCalculator');

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
   * @param {string} sessionId - 如果提供已存在的 sessionId，将复用现有会话继续对话
   * @param {number} todoId - 可选，关联到特定任务，自动添加任务上下文
   * @param {boolean} thinkingMode - 可选，是否开启思考模式（DeepSeek Reasoner）
   */
  async execute(projectName, projectPath, prompt, sessionId, todoId = null, thinkingMode = false) {
    console.log(`[AI] 🚀 开始执行 AI 任务 (SDK 模式)`);
    console.log(`[AI]   - sessionId: ${sessionId || '(新会话)'}`);
    console.log(`[AI]   - projectName: ${projectName}`);
    console.log(`[AI]   - projectPath: ${projectPath}`);
    console.log(`[AI]   - todoId: ${todoId || '(无关联任务)'}`);
    console.log(`[AI]   - thinkingMode: ${thinkingMode ? '开启' : '关闭'}`);
    console.log(`[AI]   - prompt: ${prompt}`);

    // 如果有关联任务，添加任务上下文
    let finalPrompt = prompt;
    if (todoId) {
      try {
        const todoAiManager = require('./todoAiManager');
        const taskContext = todoAiManager.generateTaskContext(todoId);
        finalPrompt = taskContext + '\n\n【用户请求】\n' + prompt;
        console.log(`[AI] 📋 已添加任务 ${todoId} 的上下文信息`);
      } catch (error) {
        console.warn(`[AI] ⚠️ 无法加载任务上下文: ${error.message}`);
      }
    }

    // 检查是否是现有会话
    const existingSession = sessionId ? this.sessions.get(sessionId) : null;

    if (existingSession && existingSession.claude_session_id) {
      console.log(`[AI] 🔄 复用现有会话 (resume): ${existingSession.claude_session_id}`);
      // 在现有会话上继续对话
      return await this.continueConversation(existingSession, finalPrompt, sessionId, projectPath, thinkingMode);
    }

    // 创建新会话
    if (!sessionId) {
      sessionId = `claude-code-${projectName}-${Date.now()}`;
    }

    const logs = [];
    const startTime = Date.now();

    try {
      // 加载 SDK
      const sdk = await this.loadSDK();
      console.log('[AI] ✅ SDK 模块已加载');

      // 准备环境变量 - 支持思考模式和 DeepSeek API Key
      const queryEnv = { ...process.env };

      // 检测是否使用 DeepSeek
      const baseUrl = process.env.ANTHROPIC_BASE_URL || '';
      const currentModel = process.env.ANTHROPIC_MODEL || '';
      const isUsingDeepSeek = baseUrl.includes('deepseek') || currentModel.toLowerCase().includes('deepseek');

      // 如果使用 DeepSeek 且配置了专用配置，优先使用
      if (isUsingDeepSeek) {
        // 优先使用 DEEPSEEK_API_KEY
        if (process.env.DEEPSEEK_API_KEY) {
          queryEnv.ANTHROPIC_API_KEY = process.env.DEEPSEEK_API_KEY;
          console.log('[AI] 🔑 使用 DeepSeek API Key');
        } else {
          console.log('[AI] ⚠️ 检测到使用 DeepSeek，但未配置 DEEPSEEK_API_KEY，将使用 ANTHROPIC_API_KEY');
        }

        // 优先使用 DEEPSEEK_BASE_URL
        if (process.env.DEEPSEEK_BASE_URL) {
          queryEnv.ANTHROPIC_BASE_URL = process.env.DEEPSEEK_BASE_URL;
          console.log(`[AI] 🌐 使用 DeepSeek Base URL: ${process.env.DEEPSEEK_BASE_URL}`);
        } else if (!queryEnv.ANTHROPIC_BASE_URL.includes('deepseek')) {
          // 如果没有配置 DEEPSEEK_BASE_URL，且当前 BASE_URL 不包含 deepseek
          // 则使用默认的 DeepSeek API 地址
          queryEnv.ANTHROPIC_BASE_URL = 'https://api.deepseek.com/anthropic';
          console.log('[AI] 🌐 使用默认 DeepSeek Base URL: https://api.deepseek.com/anthropic');
        }
      }

      // 如果开启思考模式且当前使用 DeepSeek，切换到 reasoner 模型
      if (thinkingMode) {
        if (isUsingDeepSeek) {
          queryEnv.ANTHROPIC_MODEL = 'deepseek-reasoner';
          console.log('[AI] 🧠 已启用 DeepSeek 思维模式: deepseek-reasoner');
        } else {
          console.log('[AI] ⚠️ 思考模式仅支持 DeepSeek，当前环境未使用 DeepSeek API');
        }
      } else if (process.env.ANTHROPIC_MODEL) {
        // 使用环境变量中配置的模型
        console.log(`[AI] 🤖 使用配置的模型: ${process.env.ANTHROPIC_MODEL}`);
      }

      // 创建 query
      console.log('[AI] 📝 创建 query 实例...');
      const queryInstance = sdk.query({
        prompt: finalPrompt,
        options: {
          cwd: projectPath,
          settingSources: ['project', 'user'],
          systemPrompt: {
            type: 'preset',
            preset: 'claude_code'
          },
          env: queryEnv,  // 使用准备好的环境变量
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
        projectPath,
        prompt: finalPrompt,
        todoId, // 保存关联的任务 ID
        claude_session_id: null, // 将在 init 消息中获取
        // 费用追踪
        tokenUsage: {
          input_tokens: 0,
          output_tokens: 0,
          cache_creation_tokens: 0,
          cache_read_tokens: 0
        },
        numMessages: 0,
        numToolCalls: 0,
        model: null // 将从消息中提取
      });

      // 创建数据库会话记录
      try {
        db.createAISession({
          session_id: sessionId,
          project_name: projectName,
          todo_id: todoId,
          session_type: 'chat',
          engine: 'claude-code',
          model: null, // 稍后更新
          prompt: finalPrompt
        });
        console.log('[AI] 💾 数据库会话记录已创建');
      } catch (error) {
        console.warn('[AI] ⚠️ 创建数据库记录失败:', error.message);
      }

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
   * 在现有会话上继续对话
   */
  async continueConversation(session, prompt, sessionId, projectPath, thinkingMode = false) {
    console.log(`[AI] 💬 在现有会话上继续对话 (resume): ${session.claude_session_id}`);
    console.log(`[AI]   - thinkingMode: ${thinkingMode ? '开启' : '关闭'}`);

    const startTime = Date.now();
    session.prompt = prompt; // 更新最新的 prompt

    try {
      // 加载 SDK
      const sdk = await this.loadSDK();

      // 准备环境变量 - 支持思考模式和 DeepSeek API Key
      const queryEnv = { ...process.env };

      // 检测是否使用 DeepSeek
      const baseUrl = process.env.ANTHROPIC_BASE_URL || '';
      const currentModel = process.env.ANTHROPIC_MODEL || '';
      const isUsingDeepSeek = baseUrl.includes('deepseek') || currentModel.toLowerCase().includes('deepseek');

      // 如果使用 DeepSeek 且配置了专用配置，优先使用
      if (isUsingDeepSeek) {
        // 优先使用 DEEPSEEK_API_KEY
        if (process.env.DEEPSEEK_API_KEY) {
          queryEnv.ANTHROPIC_API_KEY = process.env.DEEPSEEK_API_KEY;
          console.log('[AI] 🔑 使用 DeepSeek API Key');
        } else {
          console.log('[AI] ⚠️ 检测到使用 DeepSeek，但未配置 DEEPSEEK_API_KEY，将使用 ANTHROPIC_API_KEY');
        }

        // 优先使用 DEEPSEEK_BASE_URL
        if (process.env.DEEPSEEK_BASE_URL) {
          queryEnv.ANTHROPIC_BASE_URL = process.env.DEEPSEEK_BASE_URL;
          console.log(`[AI] 🌐 使用 DeepSeek Base URL: ${process.env.DEEPSEEK_BASE_URL}`);
        } else if (!queryEnv.ANTHROPIC_BASE_URL.includes('deepseek')) {
          // 如果没有配置 DEEPSEEK_BASE_URL，且当前 BASE_URL 不包含 deepseek
          // 则使用默认的 DeepSeek API 地址
          queryEnv.ANTHROPIC_BASE_URL = 'https://api.deepseek.com/anthropic';
          console.log('[AI] 🌐 使用默认 DeepSeek Base URL: https://api.deepseek.com/anthropic');
        }
      }

      // 如果开启思考模式且当前使用 DeepSeek，切换到 reasoner 模型
      if (thinkingMode) {
        if (isUsingDeepSeek) {
          queryEnv.ANTHROPIC_MODEL = 'deepseek-reasoner';
          console.log('[AI] 🧠 已启用 DeepSeek 思维模式: deepseek-reasoner');
        } else {
          console.log('[AI] ⚠️ 思考模式仅支持 DeepSeek，当前环境未使用 DeepSeek API');
        }
      }

      // 使用 resume 选项创建新的 query
      const queryInstance = sdk.query({
        prompt: prompt,
        options: {
          resume: session.claude_session_id, // 关键：使用 resume 继续会话
          cwd: projectPath,
          settingSources: ['project', 'user'],
          systemPrompt: {
            type: 'preset',
            preset: 'claude_code'
          },
          env: queryEnv,  // 使用准备好的环境变量
          maxTurns: 50,
        }
      });

      // 更新会话中的 query
      session.query = queryInstance;

      // 异步处理消息流
      this.processQueryStream(queryInstance, sessionId, session.logs, startTime, session.projectName, prompt);

      return {
        sessionId,
        message: 'AI 任务已启动（继续会话）',
        startTime
      };
    } catch (error) {
      console.error(`[AI] ❌ 继续对话失败: ${sessionId}`, error);
      throw error;
    }
  }

  /**
   * 处理 query 的消息流
   */
  async processQueryStream(queryInstance, sessionId, logs, startTime, projectName, prompt) {
    try {
      console.log(`[AI] 📡 开始处理消息流: ${sessionId}`);
      console.log(`[AI] 📋 项目名称: ${projectName}`);
      console.log(`[AI] ⏱️  开始时间: ${new Date(startTime).toLocaleString()}`);

      let messageCount = 0;
      let lastMessageTime = Date.now();
      const session = this.sessions.get(sessionId);

      // 使用 for await...of 迭代异步生成器
      for await (const message of queryInstance) {
        messageCount++;
        const currentTime = Date.now();
        const timeSinceLastMessage = currentTime - lastMessageTime;

        console.log(`[AI] 📨 收到第 ${messageCount} 条消息`);
        console.log(`[AI]   - 消息类型: ${message.type}`);
        console.log(`[AI]   - 距上条消息: ${timeSinceLastMessage}ms`);

        // 提取并累积 token 使用情况
        if (message.usage && session) {
          const usage = extractTokenUsage(message);
          session.tokenUsage.input_tokens += usage.input_tokens;
          session.tokenUsage.output_tokens += usage.output_tokens;
          session.tokenUsage.cache_creation_tokens += usage.cache_creation_tokens;
          session.tokenUsage.cache_read_tokens += usage.cache_read_tokens;
          session.numMessages++;

          console.log(`[AI] 💰 Token 使用: +${usage.input_tokens} 输入, +${usage.output_tokens} 输出`);
        }

        // 提取模型信息
        if (message.model && session && !session.model) {
          session.model = message.model;
          console.log(`[AI] 🤖 检测到模型: ${message.model}`);
        }

        // 统计工具调用
        if (message.type === 'tool_use' && session) {
          session.numToolCalls++;
        }

        // 将消息转换为日志条目
        const logEntry = this.messageToLogEntry(message, sessionId);

        // 如果消息被过滤（返回 null），跳过
        if (!logEntry) {
          console.log(`[AI]   - 消息已被过滤: ${message.type}/${message.subtype || 'no-subtype'}`);
          console.log(`[AI]   - 消息概要:`, {
            type: message.type,
            subtype: message.subtype,
            hasContent: !!message.content,
            hasMessage: !!message.message,
            keys: Object.keys(message).join(', ')
          });
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

      // 计算并更新费用到数据库
      if (session) {
        const costData = calculateCost(
          session.tokenUsage,
          'claude-code',
          session.model
        );

        console.log(`[AI] 💰 费用计算:`);
        console.log(`[AI]   - 总 Token: ${costData.total_tokens}`);
        console.log(`[AI]   - 总费用: $${costData.total_cost_usd}`);

        try {
          db.updateAISession(sessionId, {
            status: 'completed',
            duration_ms: duration,
            model: session.model,
            input_tokens: costData.input_tokens,
            output_tokens: costData.output_tokens,
            cache_creation_tokens: costData.cache_creation_tokens,
            cache_read_tokens: costData.cache_read_tokens,
            total_tokens: costData.total_tokens,
            input_cost: costData.input_cost,
            output_cost: costData.output_cost,
            cache_creation_cost: costData.cache_creation_cost,
            cache_read_cost: costData.cache_read_cost,
            total_cost_usd: costData.total_cost_usd,
            num_messages: session.numMessages,
            num_tool_calls: session.numToolCalls
          });
          console.log('[AI] 💾 数据库费用记录已更新');
        } catch (error) {
          console.warn('[AI] ⚠️ 更新数据库费用记录失败:', error.message);
        }
      }

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
        duration,
        engine: 'claude-code'
      });

      // 如果关联了任务，保存会话记录
      if (session && session.todoId) {
        try {
          const todoAiManager = require('./todoAiManager');
          await todoAiManager.linkSessionToTask(sessionId, session.todoId);
        } catch (error) {
          console.warn(`[AI] ⚠️ 关联任务失败: ${error.message}`);
        }
      }

      // 发送完成事件
      console.log(`[AI] 📡 发送完成事件: ai-complete:${sessionId}`);
      this.emit(`ai-complete:${sessionId}`, result);

      // ⚠️ 注意：不清理会话，保持会话以便继续对话
      // 用户可以通过 terminateSession 手动终止
      console.log(`[AI] ✅ 会话保持活跃，可以继续对话: ${sessionId}`);

    } catch (error) {
      console.error(`[AI] ❌ 处理消息流出错: ${sessionId}`, error);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 更新数据库为失败状态
      try {
        db.updateAISession(sessionId, {
          status: 'failed',
          duration_ms: duration,
          error_message: error.message
        });
        console.log('[AI] 💾 数据库失败状态已更新');
      } catch (dbError) {
        console.warn('[AI] ⚠️ 更新数据库失败状态失败:', dbError.message);
      }

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
        engine: 'claude-code'
      });

      // 发送完成事件（失败）
      this.emit(`ai-complete:${sessionId}`, result);

      // ⚠️ 注意：即使失败也不清理会话，允许用户继续尝试
      console.log(`[AI] ⚠️ 会话保持活跃（失败），用户可以继续尝试: ${sessionId}`);
    }
  }

  /**
   * 将 SDK 消息转换为日志条目（基于官方 SDKMessage 类型）
   */
  messageToLogEntry(message, sessionId) {
    // 详细日志：打印原始消息（调试用）
    if (process.env.DEBUG_AI === 'true') {
      console.log(`[AI-DEBUG] 原始消息:`, JSON.stringify(message, null, 2).substring(0, 500));
    }

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
        console.log(`[AI] 📋 系统消息 subtype: ${message.subtype}`);

        if (message.subtype === 'init') {
          // 初始化消息 - 捕获 Claude session_id
          console.log(`[AI] ⚙️  初始化消息:`, {
            cwd: message.cwd,
            settingSources: message.settingSources,
            hasTools: !!message.tools,
            toolCount: message.tools ? message.tools.length : 0,
            claude_session_id: message.session_id
          });

          // 保存 Claude session_id 到会话中
          if (message.session_id && sessionId) {
            const session = this.sessions.get(sessionId);
            if (session) {
              session.claude_session_id = message.session_id;
              console.log(`[AI] 💾 已保存 Claude session_id: ${message.session_id}`);
            }
          }

          return null;
        } else if (message.subtype === 'status') {
          // 状态消息 - 记录状态但不发送
          console.log(`[AI] 📊 状态更新:`, message.status || 'unknown');
          return null;
        } else if (message.subtype === 'compact_boundary') {
          // 压缩边界 - 跳过
          console.log(`[AI] 🔄 压缩边界消息`);
          return null;
        } else if (message.subtype === 'hook_response') {
          // Hook 响应 - 记录响应
          console.log(`[AI] 🪝 Hook 响应:`, message.response || 'no response');
          return null;
        }
        // 其他系统消息也跳过
        console.log(`[AI] ⚠️  未知系统消息 subtype:`, message.subtype);
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
   * 格式化工具执行结果（优化后的版本，参考 Codex 风格）
   */
  formatToolResult(result) {
    // result 的格式取决于工具类型
    if (!result) {
      return '✅ **执行完成**';
    }

    // 如果结果是字符串且很长，只显示摘要
    if (typeof result === 'string') {
      const lines = result.split('\n');
      if (lines.length > 10 || result.length > 1000) {
        // 只显示前3行和后3行
        return `✅ **执行完成** (${lines.length} 行输出)\n\`\`\`\n${lines.slice(0, 3).join('\n')}\n...\n${lines.slice(-3).join('\n')}\n\`\`\``;
      }
      return `✅ **执行完成**\n\`\`\`\n${result}\n\`\`\``;
    }

    // 如果结果是对象
    if (typeof result === 'object') {
      // 检查是否有特定字段
      if (result.type === 'text' && result.file) {
        // 文件读取结果
        const { file } = result;
        return `✅ **文件已读取**\n📄 \`${file.filePath}\` (${file.numLines} 行)`;
      }

      if (result.stdout || result.stderr) {
        // 命令执行结果
        const output = result.stdout || result.stderr;
        const exitCode = result.exitCode !== undefined ? result.exitCode : 0;
        const status = exitCode === 0 ? '✅' : '❌';
        const statusText = exitCode === 0 ? '成功' : '失败';

        const lines = output.split('\n');
        if (lines.length > 10 || output.length > 1000) {
          return `${status} **命令执行${statusText}** (退出码: ${exitCode})\n\`\`\`\n${lines.slice(0, 3).join('\n')}\n...\n${lines.slice(-3).join('\n')}\n\`\`\``;
        }
        return `${status} **命令执行${statusText}** (退出码: ${exitCode})\n\`\`\`\n${output}\n\`\`\``;
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
