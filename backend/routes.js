const processManager = require('./processManager');
const startupDetector = require('./startupDetector');
const aiEngineFactory = require('./aiEngineFactory');
const conversationManager = require('./conversationManager');
const db = require('./database');
const path = require('path');

/**
 * 注册进程管理相关的路由
 */
function registerProcessRoutes(app, PROJECT_ROOT, PROJECTS_CONFIG, fs) {
  // 6. 获取项目启动配置
  app.get('/api/projects/:name/startup', (req, res) => {
    try {
      const { name } = req.params;
      const project = db.getProjectByName(name);

      if (!project) {
        return res.status(404).json({ error: '项目不存在' });
      }

      // 转换数据库格式
      const projectData = {
        path: project.path,
        description: project.description,
        status: project.status,
        port: project.port,
        stack: project.tech ? JSON.parse(project.tech) : [],
        startCommand: project.start_command
      };

      const projectPath = path.isAbsolute(project.path)
        ? project.path
        : path.join(PROJECT_ROOT, project.path);

      // 自动检测启动命令
      const startup = startupDetector.detect(projectPath, projectData);

      res.json({
        detected: startup,
        manual: project.startCommand || null
      });
    } catch (error) {
      res.status(500).json({ error: '获取启动配置失败', message: error.message });
    }
  });

  // 7. 启动项目服务
  app.post('/api/projects/:name/start', (req, res) => {
    try {
      const { name } = req.params;
      const { command: customCommand } = req.body;
      const project = db.getProjectByName(name);

      if (!project) {
        return res.status(404).json({ error: '项目不存在' });
      }

      // 转换数据库格式
      const projectData = {
        path: project.path,
        description: project.description,
        status: project.status,
        port: project.port,
        stack: project.tech ? JSON.parse(project.tech) : [],
        startCommand: project.start_command
      };

      const projectPath = path.isAbsolute(project.path)
        ? project.path
        : path.join(PROJECT_ROOT, project.path);

      // 确定启动命令
      let command = customCommand;
      if (!command) {
        const startup = startupDetector.detect(projectPath, projectData);
        if (!startup) {
          return res.status(400).json({ error: '无法检测启动命令，请手动指定' });
        }
        command = startup.command;
      }

      // 启动进程
      const result = processManager.start(name, command, projectPath);

      res.json({
        success: true,
        message: '项目启动成功',
        ...result
      });
    } catch (error) {
      res.status(500).json({ error: '启动项目失败', message: error.message });
    }
  });

  // 8. 停止项目服务
  app.post('/api/projects/:name/stop', (req, res) => {
    try {
      const { name } = req.params;
      const result = processManager.stop(name);
      res.json({ success: true, message: '项目已停止' });
    } catch (error) {
      res.status(500).json({ error: '停止项目失败', message: error.message });
    }
  });

  // 9. 获取项目运行状态
  app.get('/api/projects/:name/running', (req, res) => {
    try {
      const { name } = req.params;
      const status = processManager.getStatus(name);
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: '获取运行状态失败', message: error.message });
    }
  });

  // 10. 获取项目日志（SSE 实时流）
  app.get('/api/projects/:name/logs/stream', (req, res) => {
    const { name } = req.params;

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 发送历史日志
    const historicalLogs = processManager.getLogs(name, 100);
    historicalLogs.forEach(log => {
      res.write(`data: ${JSON.stringify(log)}\n\n`);
    });

    // 监听新日志
    const logHandler = (log) => {
      res.write(`data: ${JSON.stringify(log)}\n\n`);
    };

    processManager.on(`log:${name}`, logHandler);

    // 客户端断开连接时清理
    req.on('close', () => {
      processManager.off(`log:${name}`, logHandler);
    });
  });

  // 11. 获取最近日志（HTTP）
  app.get('/api/projects/:name/logs', (req, res) => {
    try {
      const { name } = req.params;
      const limit = parseInt(req.query.limit) || 100;
      const logs = processManager.getLogs(name, limit);
      res.json({ logs });
    } catch (error) {
      res.status(500).json({ error: '获取日志失败', message: error.message });
    }
  });

  // 12. 批量操作
  app.post('/api/projects/batch', async (req, res) => {
    try {
      const { action, projectNames } = req.body;

      if (!['start', 'stop', 'restart'].includes(action)) {
        return res.status(400).json({ error: '不支持的批量操作' });
      }

      const results = [];

      for (const name of projectNames) {
        try {
          if (action === 'start') {
            const project = db.getProjectByName(name);
            if (!project) {
              results.push({ name, success: false, error: '项目不存在' });
              continue;
            }

            // 转换数据库格式
            const projectData = {
              path: project.path,
              description: project.description,
              status: project.status,
              port: project.port,
              stack: project.tech ? JSON.parse(project.tech) : [],
              startCommand: project.start_command
            };

            const projectPath = path.isAbsolute(project.path)
              ? project.path
              : path.join(PROJECT_ROOT, project.path);

            const startup = startupDetector.detect(projectPath, projectData);
            if (startup) {
              processManager.start(name, startup.command, projectPath);
              results.push({ name, success: true });
            } else {
              results.push({ name, success: false, error: '无法检测启动命令' });
            }
          } else if (action === 'stop') {
            processManager.stop(name);
            results.push({ name, success: true });
          } else if (action === 'restart') {
            processManager.stop(name);
            // 等待一秒后重启
            setTimeout(() => {
              const project = db.getProjectByName(name);
              if (!project) return;

              const projectData = {
                path: project.path,
                description: project.description,
                status: project.status,
                port: project.port,
                stack: project.tech ? JSON.parse(project.tech) : [],
                startCommand: project.start_command
              };

              const projectPath = path.isAbsolute(project.path)
                ? project.path
                : path.join(PROJECT_ROOT, project.path);
              const startup = startupDetector.detect(projectPath, projectData);
              if (startup) {
                processManager.start(name, startup.command, projectPath);
              }
            }, 1000);
            results.push({ name, success: true });
          }
        } catch (error) {
          results.push({ name, success: false, error: error.message });
        }
      }

      res.json({ results });
    } catch (error) {
      res.status(500).json({ error: '批量操作失败', message: error.message });
    }
  });

  // ========== Claude Code AI 集成 ==========

  // 13. 执行 AI 编程任务
  app.post('/api/projects/:name/ai', async (req, res) => {
    try {
      const { name } = req.params;
      const { prompt, engine = 'claude-code', conversationId, todoId } = req.body;

      console.log(`[API] 📬 收到 AI 任务请求`);
      console.log(`[API]   - projectName: ${name}`);
      console.log(`[API]   - engine: ${engine}`);
      console.log(`[API]   - prompt: ${prompt}`);
      console.log(`[API]   - conversationId: ${conversationId || '(新对话)'}`);
      console.log(`[API]   - todoId: ${todoId || '(无关联任务)'}`);

      if (!prompt || !prompt.trim()) {
        console.log('[API] ❌ 任务描述为空');
        return res.status(400).json({ error: '请提供任务描述' });
      }

      const project = db.getProjectByName(name);

      if (!project) {
        console.log(`[API] ❌ 项目不存在: ${name}`);
        return res.status(404).json({ error: '项目不存在' });
      }

      const projectPath = path.isAbsolute(project.path)
        ? project.path
        : path.join(PROJECT_ROOT, project.path);

      console.log(`[API] ✅ 项目路径: ${projectPath}`);

      // 如果提供了 conversationId，生成该引擎对应的 sessionId
      // 否则创建新的 conversationId
      const actualConversationId = conversationId || `${name}-${Date.now()}`;
      const sessionId = `${engine}-${actualConversationId}`;

      console.log(`[API] 🆔 对话 ID: ${actualConversationId}`);
      console.log(`[API] 🆔 会话 ID (${engine}): ${sessionId}`);

      // ⚠️ 重要：必须先获取上下文，再添加用户消息
      // 因为 addUserMessage 会更新 lastEngine，导致检测不到引擎切换

      // 1. 先获取跨引擎上下文（在更新 lastEngine 之前）
      const contextPrompt = conversationManager.getContextPrompt(actualConversationId, engine);

      // 2. 再保存用户消息到对话历史
      conversationManager.addUserMessage(actualConversationId, engine, prompt);

      // 3. 将上下文附加到用户 prompt
      const fullPrompt = contextPrompt ? contextPrompt + prompt : prompt;

      if (contextPrompt) {
        const stats = conversationManager.getStats(actualConversationId);
        console.log(`[API] 📋 附加跨引擎上下文`);
        console.log(`[API]   - 历史消息数: ${stats.messageCount}`);
        console.log(`[API]   - 上下文长度: ${contextPrompt.length} 字符`);
        console.log(`[API]   - 上下文预览: ${contextPrompt.substring(0, 100)}...`);
      } else {
        console.log(`[API] ℹ️  无需附加上下文（同引擎继续或首次对话）`);
      }

      // 异步执行（不等待完成），传入 todoId 参数
      console.log(`[API] 🚀 启动 AI 任务 (${engine})...`);
      aiEngineFactory.execute(engine, name, projectPath, fullPrompt, sessionId, todoId)
        .then(result => {
          console.log(`[API] ✅ AI 任务完成: ${sessionId}`);
        })
        .catch(error => {
          console.error(`[API] ❌ AI 任务失败: ${sessionId}`, error);
        });

      // 监听完成事件，保存 AI 回复
      const completeHandler = (result) => {
        console.log(`[API] 📬 收到完成事件: ${sessionId}`);
        console.log(`[API]   - success: ${result.success}`);
        console.log(`[API]   - logs 数量: ${result.logs ? result.logs.length : 0}`);

        if (result.success && result.logs) {
          // 提取 AI 的文本回复
          const assistantMessages = result.logs
            .filter(log => log.type === 'stdout' && log.content)
            .map(log => log.content)
            .join('\n\n');

          console.log(`[API]   - 提取的文本消息长度: ${assistantMessages.length}`);

          if (assistantMessages) {
            console.log(`[API] 📝 保存 AI 回复到对话历史`);
            console.log(`[API]   - conversationId: ${actualConversationId}`);
            console.log(`[API]   - engine: ${engine}`);
            console.log(`[API]   - 消息预览: ${assistantMessages.substring(0, 50)}...`);
            conversationManager.addAssistantMessage(actualConversationId, engine, assistantMessages);
          } else {
            console.log(`[API] ⚠️  没有提取到文本消息`);
          }
        } else {
          console.log(`[API] ⚠️  任务失败或无日志`);
        }

        // 移除监听器
        aiEngineFactory.off(engine, `ai-complete:${sessionId}`, completeHandler);
        console.log(`[API] 🧹 已移除监听器: ai-complete:${sessionId}`);
      };

      console.log(`[API] 👂 注册完成事件监听器: ai-complete:${sessionId}`);
      aiEngineFactory.on(engine, `ai-complete:${sessionId}`, completeHandler);

      // 立即返回会话信息
      console.log(`[API] 📤 返回会话信息`);
      res.json({
        success: true,
        message: conversationId ? 'AI 任务已启动（继续对话）' : 'AI 任务已启动',
        conversationId: actualConversationId,
        sessionId,
        engine,
        prompt,
        hasContext: !!contextPrompt
      });
    } catch (error) {
      console.error('[API] ❌ 启动 AI 任务失败:', error);
      res.status(500).json({ error: '启动 AI 任务失败', message: error.message });
    }
  });

  // 14. AI 实时输出流（SSE）
  app.get('/api/projects/:name/ai/stream/:sessionId', (req, res) => {
    const { name, sessionId } = req.params;

    // 从 sessionId 中提取引擎类型
    // sessionId 格式: {engine}-{projectName}-{timestamp}
    // 需要智能匹配，因为 engine 本身可能包含连字符 (如 claude-code)
    let engine = 'claude-code'; // 默认引擎
    if (sessionId.startsWith('codex-')) {
      engine = 'codex';
    } else if (sessionId.startsWith('claude-code-')) {
      engine = 'claude-code';
    }

    console.log(`[SSE] 📡 新的 SSE 连接`);
    console.log(`[SSE]   - projectName: ${name}`);
    console.log(`[SSE]   - sessionId: ${sessionId}`);
    console.log(`[SSE]   - engine: ${engine}`);

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    console.log(`[SSE] ✅ SSE 响应头已设置`);

    // 不发送历史日志，因为这是实时流连接
    // 所有消息都会通过 EventEmitter 实时发送
    console.log(`[SSE] 📜 跳过历史日志（实时流模式）`);

    // 监听新输出
    const outputHandler = (log) => {
      console.log(`[SSE] 📨 收到新输出事件: ${log.type}, ${log.content?.substring(0, 50) || ''}...`);
      res.write(`data: ${JSON.stringify(log)}\n\n`);
      console.log(`[SSE] ✅ 已发送到客户端`);
    };

    const completeHandler = (result) => {
      console.log(`[SSE] 🏁 收到完成事件: ${sessionId}, success: ${result.success}`);
      res.write(`data: ${JSON.stringify({ type: 'complete', ...result })}\n\n`);
      console.log(`[SSE] ✅ 完成事件已发送到客户端`);
    };

    console.log(`[SSE] 👂 开始监听事件:`);
    console.log(`[SSE]   - ai-output:${sessionId}`);
    console.log(`[SSE]   - ai-complete:${sessionId}`);
    aiEngineFactory.on(engine, `ai-output:${sessionId}`, outputHandler);
    aiEngineFactory.on(engine, `ai-complete:${sessionId}`, completeHandler);

    // 客户端断开连接时清理
    req.on('close', () => {
      console.log(`[SSE] 🔌 客户端断开连接: ${sessionId}`);
      aiEngineFactory.off(engine, `ai-output:${sessionId}`, outputHandler);
      aiEngineFactory.off(engine, `ai-complete:${sessionId}`, completeHandler);
      console.log(`[SSE] 🧹 事件监听器已清理`);
    });
  });

  // 15. 获取 AI 会话状态
  app.get('/api/projects/:name/ai/status/:sessionId', (req, res) => {
    try {
      const { sessionId } = req.params;

      // 从 sessionId 中提取引擎类型
      let engine = 'claude-code';
      if (sessionId.startsWith('codex-')) {
        engine = 'codex';
      } else if (sessionId.startsWith('claude-code-')) {
        engine = 'claude-code';
      }

      const status = aiEngineFactory.getSessionStatus(engine, sessionId);
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: '获取会话状态失败', message: error.message });
    }
  });

  // 16. 终止 AI 会话
  app.post('/api/projects/:name/ai/terminate/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;

      // 从 sessionId 中提取引擎类型
      let engine = 'claude-code';
      if (sessionId.startsWith('codex-')) {
        engine = 'codex';
      } else if (sessionId.startsWith('claude-code-')) {
        engine = 'claude-code';
      }

      const result = await aiEngineFactory.terminateSession(engine, sessionId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: '终止会话失败', message: error.message });
    }
  });

  // 17. 获取 AI 执行历史
  app.get('/api/projects/:name/ai/history', (req, res) => {
    try {
      const { name } = req.params;
      const { engine = 'claude-code' } = req.query;
      const limit = parseInt(req.query.limit) || 10;
      const history = aiEngineFactory.getHistory(engine, name, limit);
      res.json({ history, engine });
    } catch (error) {
      res.status(500).json({ error: '获取历史记录失败', message: error.message });
    }
  });

  // 18. 获取历史记录详情
  app.get('/api/projects/:name/ai/history/:recordId', (req, res) => {
    try {
      const { name, recordId } = req.params;
      const { engine = 'claude-code' } = req.query;

      console.log('[API] 📖 获取历史记录详情');
      console.log('[API]   - projectName:', name);
      console.log('[API]   - recordId:', recordId);
      console.log('[API]   - engine:', engine);

      const record = aiEngineFactory.getHistoryDetail(engine, name, recordId);

      if (!record) {
        console.log('[API] ❌ 历史记录不存在');
        return res.status(404).json({ error: '历史记录不存在' });
      }

      console.log('[API] ✅ 找到历史记录');
      console.log('[API]   - id:', record.id);
      console.log('[API]   - prompt:', record.prompt?.substring(0, 50) + '...');
      console.log('[API]   - logs 数量:', record.logs?.length || 0);
      console.log('[API]   - success:', record.success);

      res.json(record);
    } catch (error) {
      res.status(500).json({ error: '获取历史详情失败', message: error.message });
    }
  });

  // 19. 清空历史记录
  app.delete('/api/projects/:name/ai/history', (req, res) => {
    try {
      const { name } = req.params;
      const { engine = 'claude-code' } = req.query;
      const result = aiEngineFactory.clearHistory(engine, name);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: '清空历史失败', message: error.message });
    }
  });

  // 20. 清除对话上下文
  app.delete('/api/conversations/:conversationId', (req, res) => {
    try {
      const { conversationId } = req.params;
      conversationManager.clearConversation(conversationId);
      res.json({ success: true, message: '对话上下文已清除' });
    } catch (error) {
      res.status(500).json({ error: '清除对话失败', message: error.message });
    }
  });

  // 21. 获取对话统计
  app.get('/api/conversations/:conversationId/stats', (req, res) => {
    try {
      const { conversationId } = req.params;
      const stats = conversationManager.getStats(conversationId);
      if (!stats) {
        return res.status(404).json({ error: '对话不存在' });
      }
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: '获取对话统计失败', message: error.message });
    }
  });

  // 22. 获取所有活跃的 AI 会话
  app.get('/api/ai/sessions', (req, res) => {
    try {
      const { engine = 'claude-code' } = req.query;
      const sessions = aiEngineFactory.getActiveSessions(engine);
      res.json({ sessions, engine });
    } catch (error) {
      res.status(500).json({ error: '获取会话列表失败', message: error.message });
    }
  });

  // 21. 获取可用的 AI 引擎列表
  app.get('/api/ai/engines', (req, res) => {
    try {
      const engines = aiEngineFactory.getAvailableEngines();
      res.json({ engines });
    } catch (error) {
      res.status(500).json({ error: '获取引擎列表失败', message: error.message });
    }
  });

  // 22. 检查引擎可用性
  app.get('/api/ai/engines/:engine/check', async (req, res) => {
    try {
      const { engine } = req.params;
      const available = await aiEngineFactory.checkEngineAvailable(engine);
      res.json({ engine, available });
    } catch (error) {
      res.json({ engine: req.params.engine, available: false, error: error.message });
    }
  });
}

module.exports = { registerProcessRoutes };
