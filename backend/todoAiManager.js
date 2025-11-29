const EventEmitter = require('events');
const db = require('./database');

/**
 * Todo AI 管理器 - 实现任务拆分、协作、验证功能
 */
class TodoAiManager extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map(); // 存储活跃的 AI 会话
  }

  /**
   * 动态导入 Claude Agent SDK
   */
  async loadSDK() {
    if (!this.sdkModule) {
      console.log('[TodoAI] 🔄 动态加载 Claude Agent SDK...');
      try {
        this.sdkModule = await import('@anthropic-ai/claude-agent-sdk');
        console.log('[TodoAI] ✅ Claude Agent SDK 加载成功');
      } catch (error) {
        console.error('[TodoAI] ❌ 加载 Claude Agent SDK 失败:', error);
        throw new Error('无法加载 Claude Agent SDK: ' + error.message);
      }
    }
    return this.sdkModule;
  }

  /**
   * AI 任务拆分 - 将一句话描述拆分为可执行的子任务
   */
  async decomposeTask(projectName, projectPath, description) {
    const sessionId = `decompose-${projectName}-${Date.now()}`;
    console.log(`[TodoAI] 🔀 开始任务拆分: ${sessionId}`);

    // 构建任务拆分的 prompt
    const prompt = `作为一个项目管理助手，请将以下任务描述拆分为具体可执行的子任务：

【任务描述】
${description}

【要求】
1. 将任务拆分为 3-8 个具体的子任务
2. 每个子任务应该是独立、可验证的工作单元
3. 按照执行顺序排列子任务
4. 为每个子任务估算工时（小时）
5. 为每个子任务设置优先级（low/medium/high/urgent）

【输出格式】
请严格按照以下 JSON 格式输出（不要添加任何其他文字）：
{
  "mainTask": {
    "title": "主任务标题",
    "description": "主任务详细描述",
    "estimated_hours": 总工时,
    "priority": "优先级"
  },
  "subtasks": [
    {
      "title": "子任务1标题",
      "description": "子任务1详细描述",
      "estimated_hours": 工时,
      "priority": "优先级",
      "order": 1
    }
  ]
}`;

    try {
      // 创建数据库记录
      db.createAiSession({
        session_id: sessionId,
        project_name: projectName,
        session_type: 'decompose',
        prompt: description,
        status: 'running'
      });

      // 加载 SDK
      const sdk = await this.loadSDK();

      // 创建 query
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
          maxTurns: 10
        }
      });

      // 保存会话
      this.sessions.set(sessionId, {
        query: queryInstance,
        projectName,
        sessionType: 'decompose',
        startTime: Date.now()
      });

      // 异步处理
      this.processDecomposeStream(queryInstance, sessionId, projectName, description);

      return {
        sessionId,
        message: '任务拆分已启动',
        status: 'running'
      };

    } catch (error) {
      console.error(`[TodoAI] ❌ 任务拆分失败: ${sessionId}`, error);
      db.updateAiSession(sessionId, {
        status: 'failed',
        error_message: error.message
      });
      throw error;
    }
  }

  /**
   * 处理任务拆分的消息流
   */
  async processDecomposeStream(queryInstance, sessionId, projectName, originalDescription) {
    const startTime = Date.now();
    let fullResponse = '';

    try {
      console.log(`[TodoAI] 📡 处理任务拆分流: ${sessionId}`);

      for await (const message of queryInstance) {
        // 提取 AI 响应文本
        const text = this.extractMessageText(message);
        if (text) {
          fullResponse += text;

          // 保存消息到数据库
          db.createAiMessage({
            session_id: sessionId,
            message_type: message.type,
            content: text
          });

          // 发送进度事件
          this.emit(`decompose:${sessionId}`, {
            type: 'progress',
            content: text
          });
        }
      }

      // 解析 JSON 结果
      const result = this.parseDecomposeResult(fullResponse);

      if (result) {
        console.log(`[TodoAI] ✅ 任务拆分完成，共 ${result.subtasks.length} 个子任务`);

        // 更新会话状态
        const duration = Date.now() - startTime;
        db.updateAiSession(sessionId, {
          status: 'completed',
          duration_ms: duration,
          result_summary: result
        });

        // 发送完成事件
        this.emit(`decompose:${sessionId}`, {
          type: 'completed',
          result: result
        });

      } else {
        throw new Error('无法解析任务拆分结果');
      }

    } catch (error) {
      console.error(`[TodoAI] ❌ 任务拆分流处理失败: ${sessionId}`, error);

      db.updateAiSession(sessionId, {
        status: 'failed',
        error_message: error.message
      });

      this.emit(`decompose:${sessionId}`, {
        type: 'failed',
        error: error.message
      });
    } finally {
      this.sessions.delete(sessionId);
    }
  }

  /**
   * 解析任务拆分结果
   */
  parseDecomposeResult(text) {
    try {
      // 尝试提取 JSON 块
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[TodoAI] ⚠️ 未找到 JSON 格式的结果');
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // 验证结构
      if (parsed.mainTask && parsed.subtasks && Array.isArray(parsed.subtasks)) {
        return parsed;
      }

      return null;
    } catch (error) {
      console.error('[TodoAI] ❌ 解析任务拆分结果失败:', error);
      return null;
    }
  }

  /**
   * 生成任务上下文提示词
   * 供现有 AI 助手使用，无需重复实现协作功能
   */
  generateTaskContext(todoId) {
    const todo = db.getTodoById(todoId);
    if (!todo) {
      throw new Error(`任务 ${todoId} 不存在`);
    }

    // 获取子任务
    const subtasks = db.getTodosByProject(todo.project_name, { parent_id: todoId });

    // 获取验证记录
    const verification = db.getLatestAiVerification(todoId);

    let context = `
【当前任务上下文】
- 任务标题: ${todo.title}
- 任务描述: ${todo.description || '无'}
- 任务类型: ${todo.type}
- 优先级: ${todo.priority}
- 状态: ${todo.status}
- 预估工时: ${todo.estimated_hours || '未设置'}小时
- 实际工时: ${todo.actual_hours || 0}小时
`;

    if (subtasks && subtasks.length > 0) {
      context += `\n【子任务列表】\n`;
      subtasks.forEach((sub, idx) => {
        context += `${idx + 1}. [${sub.status}] ${sub.title}\n`;
      });
    }

    if (verification) {
      context += `\n【最近验证结果】\n`;
      context += `- 结果: ${verification.result}\n`;
      context += `- 置信度: ${(verification.confidence * 100).toFixed(0)}%\n`;
      if (verification.issues_found && verification.issues_found.length > 0) {
        context += `- 发现的问题: ${verification.issues_found.join(', ')}\n`;
      }
    }

    context += `\n请基于以上任务信息，提供针对性的技术建议和实现方案。\n`;

    return context;
  }

  /**
   * 保存 AI 会话到任务关联记录
   * 在现有 AI 对话结束后调用，建立任务关联
   */
  async linkSessionToTask(aiSessionId, todoId) {
    try {
      // 保存到数据库
      db.createAiSession({
        session_id: aiSessionId,
        project_name: db.getTodoById(todoId).project_name,
        todo_id: todoId,
        session_type: 'collaborate',
        prompt: 'Task collaboration',
        status: 'completed'
      });

      console.log(`[TodoAI] ✅ AI 会话 ${aiSessionId} 已关联到任务 ${todoId}`);
      return { success: true };
    } catch (error) {
      console.error(`[TodoAI] ❌ 关联会话失败:`, error);
      throw error;
    }
  }

  /**
   * AI 任务验证 - 自动验证任务是否完成
   */
  async verifyTask(todoId, projectName, projectPath) {
    const sessionId = `verify-${todoId}-${Date.now()}`;
    console.log(`[TodoAI] ✔️ 开始任务验证: ${sessionId}`);

    try {
      // 获取任务详情
      const todo = db.getTodoById(todoId);
      if (!todo) {
        throw new Error(`任务 ${todoId} 不存在`);
      }

      // 构建验证 prompt
      const verifyPrompt = `请验证以下任务是否已正确完成：

【任务信息】
- 标题: ${todo.title}
- 描述: ${todo.description || '无'}
- 类型: ${todo.type}

【验证要求】
1. 检查相关代码是否已实现
2. 运行相关测试（如果有）
3. 检查代码质量和规范
4. 评估完成度和质量

【输出格式】
请严格按照以下 JSON 格式输出验证结果：
{
  "result": "passed|failed|partial",
  "confidence": 0.95,
  "issues_found": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"],
  "evidence": {
    "tests_passed": true,
    "code_quality": "good",
    "coverage": 85
  }
}`;

      // 创建数据库记录
      db.createAiSession({
        session_id: sessionId,
        project_name: projectName,
        todo_id: todoId,
        session_type: 'verify',
        prompt: 'Auto verification',
        status: 'running'
      });

      // 加载 SDK
      const sdk = await this.loadSDK();

      // 创建 query
      const queryInstance = sdk.query({
        prompt: verifyPrompt,
        options: {
          cwd: projectPath,
          settingSources: ['project', 'user'],
          systemPrompt: {
            type: 'preset',
            preset: 'claude_code'
          },
          env: { ...process.env },
          maxTurns: 10
        }
      });

      // 保存会话
      this.sessions.set(sessionId, {
        query: queryInstance,
        projectName,
        todoId,
        sessionType: 'verify',
        startTime: Date.now()
      });

      // 异步处理
      this.processVerifyStream(queryInstance, sessionId, todoId);

      return {
        sessionId,
        message: '任务验证已启动',
        status: 'running'
      };

    } catch (error) {
      console.error(`[TodoAI] ❌ 任务验证启动失败: ${sessionId}`, error);
      throw error;
    }
  }

  /**
   * 处理任务验证的消息流
   */
  async processVerifyStream(queryInstance, sessionId, todoId) {
    const startTime = Date.now();
    let fullResponse = '';

    try {
      console.log(`[TodoAI] 📡 处理任务验证流: ${sessionId}`);

      for await (const message of queryInstance) {
        const text = this.extractMessageText(message);
        if (text) {
          fullResponse += text;

          db.createAiMessage({
            session_id: sessionId,
            message_type: message.type,
            content: text
          });

          this.emit(`verify:${sessionId}`, {
            type: 'progress',
            content: text
          });
        }
      }

      // 解析验证结果
      const verification = this.parseVerifyResult(fullResponse);

      if (verification) {
        console.log(`[TodoAI] ✅ 任务验证完成: ${verification.result}`);

        // 保存验证记录
        db.createAiVerification({
          todo_id: todoId,
          session_id: sessionId,
          verification_type: 'automatic',
          result: verification.result,
          confidence: verification.confidence,
          issues_found: verification.issues_found,
          suggestions: verification.suggestions,
          evidence: verification.evidence
        });

        // 更新会话状态
        const duration = Date.now() - startTime;
        db.updateAiSession(sessionId, {
          status: 'completed',
          duration_ms: duration,
          result_summary: verification
        });

        // 发送完成事件
        this.emit(`verify:${sessionId}`, {
          type: 'completed',
          result: verification
        });

      } else {
        throw new Error('无法解析验证结果');
      }

    } catch (error) {
      console.error(`[TodoAI] ❌ 任务验证流处理失败: ${sessionId}`, error);

      db.updateAiSession(sessionId, {
        status: 'failed',
        error_message: error.message
      });

      this.emit(`verify:${sessionId}`, {
        type: 'failed',
        error: error.message
      });
    } finally {
      this.sessions.delete(sessionId);
    }
  }

  /**
   * 解析验证结果
   */
  parseVerifyResult(text) {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (parsed.result && ['passed', 'failed', 'partial'].includes(parsed.result)) {
        return parsed;
      }

      return null;
    } catch (error) {
      console.error('[TodoAI] ❌ 解析验证结果失败:', error);
      return null;
    }
  }

  /**
   * 提取消息文本
   */
  extractMessageText(message) {
    if (message.type === 'assistant' && message.message && message.message.content) {
      return message.message.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n');
    }
    return null;
  }

  /**
   * 将消息转换为日志条目（复用 aiManager 的逻辑）
   */
  messageToLogEntry(message, sessionId) {
    const entry = {
      time: Date.now(),
      sessionId,
      messageType: message.type,
      metadata: {}
    };

    switch (message.type) {
      case 'assistant': {
        const text = this.extractMessageText(message);
        if (!text || text.trim() === '') return null;
        entry.type = 'stdout';
        entry.content = text;
        break;
      }

      case 'result': {
        if (message.subtype === 'success') {
          entry.type = 'stdout';
          entry.content = `\n✅ 任务完成 (${(message.duration_ms / 1000).toFixed(2)}秒)`;
        } else {
          entry.type = 'stderr';
          entry.content = `\n❌ 执行出错: ${message.errors ? message.errors.join('\n') : ''}`;
        }
        break;
      }

      default:
        return null;
    }

    return entry;
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
      if (session.query && typeof session.query.interrupt === 'function') {
        await session.query.interrupt();
      }

      db.updateAiSession(sessionId, {
        status: 'terminated'
      });

      this.sessions.delete(sessionId);
      return { success: true, message: '会话已终止' };
    } catch (error) {
      console.error(`[TodoAI] ❌ 终止会话失败: ${sessionId}`, error);
      this.sessions.delete(sessionId);
      return { success: true, message: '会话已强制终止' };
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
      sessionType: session.sessionType,
      projectName: session.projectName,
      todoId: session.todoId,
      startTime: session.startTime,
      uptime: Date.now() - session.startTime
    };
  }
}

module.exports = new TodoAiManager();
